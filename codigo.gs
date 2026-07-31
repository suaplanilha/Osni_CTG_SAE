/** Controller público do WebApp SAE. */
function doGet(e) {
  const asset = e && e.parameter && e.parameter.asset;
  if (asset === 'manifest') {
    return ContentService.createTextOutput(JSON.stringify({
      name: 'Sistema Campeiro SAE', short_name: 'SAE Campeiro', start_url: '?source=pwa',
      display: 'standalone', background_color: '#0f172a', theme_color: '#4f46e5', lang: 'pt-BR',
      icons: [{ src: 'https://fonts.gstatic.com/s/i/materialiconsoutlined/emoji_events/v12/24px.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }]
    })).setMimeType(ContentService.MimeType.JSON);
  }
  if (asset === 'sw') {
    return ContentService.createTextOutput("self.addEventListener('install',()=>self.skipWaiting());self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{if(e.request.method==='GET')e.respondWith(fetch(e.request).catch(()=>new Response('Offline',{status:503})));});")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return HtmlService.createHtmlOutputFromFile('Index').setTitle('Sistema de Torneios Campeiros - SAE')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0').addMetaTag('theme-color', '#4f46e5');
}

function apiGetModalidades() {
  return apiResponse_(() => MODALIDADES.map(item => Object.assign({}, item)));
}

function apiGetEquipes() { return apiResponse_(() => dbRead('tb_equipes')); }

function apiCadastrarInscrito(payload) {
  return apiResponse_(() => withDatabaseLock_(() => {
    payload = payload || {};
    const nome = requiredText_(payload.nome, 'Nome da equipe', 120);
    const ctg = requiredText_(payload.ctg, 'CTG/Entidade', 120);
    const contato = optionalText_(payload.contato, 120);
    const modalidade = getModalidadeRegra(payload.id_modalidade);
    if (!modalidade) throw new Error('Selecione uma modalidade válida.');
    const duplicada = dbRead('tb_equipes').some(eq => normalize_(eq.nome_equipe) === normalize_(nome) && normalize_(eq.ctg_responsavel) === normalize_(ctg));
    if (duplicada) throw new Error('Esta equipe já está cadastrada para o CTG informado.');
    const now = getISODate();
    const equipe = { id_equipe: generateUUID(), nome_equipe: nome, ctg_responsavel: ctg, contato, data_criacao: now, data_atualizacao: now, ativo: true };
    const inscricao = { id_inscricao: generateUUID(), id_equipe: equipe.id_equipe, id_modalidade: modalidade.id_modalidade, status: 'CONFIRMADO', data_inscricao: now, data_atualizacao: now, ativo: true };
    dbInsertUnsafe_('tb_equipes', equipe);
    try { dbInsertUnsafe_('tb_inscricoes', inscricao); }
    catch (error) { dbUpdateUnsafe_('tb_equipes', 'id_equipe', equipe.id_equipe, { ativo: false, data_atualizacao: getISODate() }); throw error; }
    return equipe;
  }));
}

function apiExcluirInscrito(idEquipe) {
  return apiResponse_(() => withDatabaseLock_(() => {
    const id = requiredText_(idEquipe, 'Equipe', 80);
    const partidasAtivas = dbRead('tb_partidas').some(p => p.id_equipe_a === id || p.id_equipe_b === id);
    if (partidasAtivas) throw new Error('A equipe possui partidas ativas e não pode ser removida.');
    const now = getISODate();
    const equipeResult = dbUpdateUnsafe_('tb_equipes', 'id_equipe', id, { ativo: false, data_atualizacao: now });
    if (!equipeResult.success) throw new Error(equipeResult.error);
    dbRead('tb_inscricoes').filter(i => i.id_equipe === id).forEach(i => dbUpdateUnsafe_('tb_inscricoes', 'id_inscricao', i.id_inscricao, { ativo: false, status: 'CANCELADO', data_atualizacao: now }));
    return { id_equipe: id };
  }));
}

function apiGerarChaves(idModalidade) {
  return apiResponse_(() => withDatabaseLock_(() => {
    const modalidade = getModalidadeRegra(idModalidade);
    if (!modalidade) throw new Error('Modalidade inválida.');
    if (dbRead('tb_partidas').some(p => p.id_modalidade === modalidade.id_modalidade)) throw new Error('Já existem chaves ativas para esta modalidade.');
    const equipesAtivas = new Set(dbRead('tb_equipes').map(e => e.id_equipe));
    const inscritos = dbRead('tb_inscricoes').filter(i => i.id_modalidade === modalidade.id_modalidade && i.status === 'CONFIRMADO' && equipesAtivas.has(i.id_equipe));
    if (inscritos.length < 2) throw new Error('Cadastre ao menos duas equipes nesta modalidade.');
    const ids = shuffle_(inscritos.map(i => i.id_equipe));
    const now = getISODate();
    const partidas = [];
    for (let index = 0; index < ids.length - 1; index += 2) {
      const partida = { id_partida: generateUUID(), id_modalidade: modalidade.id_modalidade, rodada: 1, chave: `R1-C${(index / 2) + 1}`, ordem: (index / 2) + 1, id_equipe_a: ids[index], placar_a: '', id_equipe_b: ids[index + 1], placar_b: '', status_partida: 'AGENDADO', data_criacao: now, data_atualizacao: now, ativo: true };
      dbInsertUnsafe_('tb_partidas', partida); partidas.push(partida);
    }
    return { partidas_criadas: partidas.length, bye: ids.length % 2 ? ids[ids.length - 1] : null };
  }));
}

function apiGetPartidasPorModalidade(idModalidade) {
  return apiResponse_(() => {
    if (!getModalidadeRegra(idModalidade)) throw new Error('Modalidade inválida.');
    const equipes = {};
    dbRead('tb_equipes', true).forEach(e => { equipes[e.id_equipe] = e; });
    return dbRead('tb_partidas').filter(p => p.id_modalidade === idModalidade).sort((a, b) => Number(a.ordem) - Number(b.ordem)).map(p => Object.assign({}, p, {
      equipeA: equipes[p.id_equipe_a] ? equipes[p.id_equipe_a].nome_equipe : 'Equipe indisponível', ctgA: equipes[p.id_equipe_a] ? equipes[p.id_equipe_a].ctg_responsavel : '',
      equipeB: equipes[p.id_equipe_b] ? equipes[p.id_equipe_b].nome_equipe : 'Equipe indisponível', ctgB: equipes[p.id_equipe_b] ? equipes[p.id_equipe_b].ctg_responsavel : ''
    }));
  });
}

function apiSalvarResultadoPartida(payload) {
  return apiResponse_(() => withDatabaseLock_(() => {
    payload = payload || {};
    const partida = dbRead('tb_partidas').find(p => p.id_partida === payload.id_partida);
    if (!partida) throw new Error('Partida não encontrada.');
    const placar = validarPlacarModalidade(partida.id_modalidade, payload.placar_a, payload.placar_b);
    const result = dbUpdateUnsafe_('tb_partidas', 'id_partida', partida.id_partida, Object.assign({}, placar, { status_partida: 'FINALIZADO', data_atualizacao: getISODate() }));
    if (!result.success) throw new Error(result.error);
    processarPontuacaoGeralUnsafe_();
    return { id_partida: partida.id_partida };
  }));
}

function apiGetClassificacaoGeral() { return apiResponse_(() => dbRead('tb_pontuacao_geral').sort((a, b) => Number(b.pontos_totais) - Number(a.pontos_totais) || Number(b.vitorias_totais) - Number(a.vitorias_totais) || String(a.ctg).localeCompare(String(b.ctg), 'pt-BR'))); }
function processarPontuacaoGeral() { return withDatabaseLock_(() => processarPontuacaoGeralUnsafe_()); }

function processarPontuacaoGeralUnsafe_() {
  const equipes = {}; dbRead('tb_equipes', true).forEach(e => { equipes[e.id_equipe] = e.ctg_responsavel; });
  const ranking = {};
  dbRead('tb_partidas').filter(p => p.status_partida === 'FINALIZADO').forEach(p => {
    [[p.id_equipe_a, p.placar_a, p.placar_b], [p.id_equipe_b, p.placar_b, p.placar_a]].forEach(item => {
      const ctg = equipes[item[0]]; if (!ctg) return;
      if (!ranking[ctg]) ranking[ctg] = { pontos: 0, vitorias: 0 };
      ranking[ctg].pontos += Number(item[1]); if (Number(item[1]) > Number(item[2])) ranking[ctg].vitorias++;
    });
  });
  const sheet = getSheet_('tb_pontuacao_geral');
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  const rows = Object.keys(ranking).map(ctg => [generateUUID(), ctg, ranking[ctg].pontos, ranking[ctg].vitorias, getISODate()]);
  if (rows.length) sheet.getRange(2, 1, rows.length, 5).setValues(rows);
  return { registros: rows.length };
}

function apiResponse_(callback) { try { return { success: true, data: callback() }; } catch (error) { console.error(error); return { success: false, error: error.message || String(error) }; } }
function requiredText_(value, label, max) { const text = String(value || '').trim(); if (!text) throw new Error(`${label} é obrigatório.`); if (text.length > max) throw new Error(`${label} deve ter no máximo ${max} caracteres.`); return text; }
function optionalText_(value, max) { const text = String(value || '').trim(); if (text.length > max) throw new Error(`Campo deve ter no máximo ${max} caracteres.`); return text; }
function normalize_(value) { return String(value || '').trim().toLocaleLowerCase('pt-BR'); }
function shuffle_(items) { const result = items.slice(); for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }
