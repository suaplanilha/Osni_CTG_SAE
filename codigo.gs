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
  return { success: false, error: 'Cadastro simplificado desativado. Use a inscrição regulamentar com CTG e atletas.' };
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
    const torneio = dbRead('tb_torneios').find(item => item.status !== 'ENCERRADO') || dbRead('tb_torneios')[0]; if (!torneio) throw new Error('Torneio ativo não encontrado.');
    if (dbRead('tb_partidas').some(p => p.id_torneio === torneio.id_torneio && p.id_modalidade === modalidade.id_modalidade)) throw new Error('Já existem chaves ativas para esta modalidade.');
    const equipesAtivas = new Set(dbRead('tb_equipes').map(e => e.id_equipe));
    const inscritos = dbRead('tb_inscricoes').filter(i => i.id_torneio === torneio.id_torneio && i.id_modalidade === modalidade.id_modalidade && ['CONFIRMADO', 'CONFIRMADA'].includes(i.status) && equipesAtivas.has(i.id_equipe));
    if (inscritos.length < 2) throw new Error('Cadastre ao menos duas equipes nesta modalidade.');
    const ids = shuffle_(inscritos.map(i => i.id_equipe));
    const now = getISODate();
    const partidas = [];
    for (let index = 0; index < ids.length - 1; index += 2) {
      const partida = { id_partida: generateUUID(), id_torneio: inscritos[0].id_torneio || '', id_modalidade: modalidade.id_modalidade, rodada: 1, chave: `R1-C${(index / 2) + 1}`, ordem: (index / 2) + 1, id_equipe_a: ids[index], placar_a: '', id_equipe_b: ids[index + 1], placar_b: '', status_partida: 'AGENDADO', pontos_desempate_a: '', pontos_desempate_b: '', tipo_desempate: '', data_criacao: now, data_atualizacao: now, ativo: true };
      dbInsertUnsafe_('tb_partidas', partida); partidas.push(partida);
    }
    return { partidas_criadas: partidas.length, bye: ids.length % 2 ? ids[ids.length - 1] : null };
  }));
}

function apiGetPartidasPorModalidade(idModalidade) {
  return apiResponse_(() => {
    if (!getModalidadeRegra(idModalidade)) throw new Error('Modalidade inválida.');
    const torneio = dbRead('tb_torneios').find(item => item.status !== 'ENCERRADO') || dbRead('tb_torneios')[0];
    const equipes = {};
    dbRead('tb_equipes', true).forEach(e => { equipes[e.id_equipe] = e; });
    return dbRead('tb_partidas').filter(p => (!torneio || p.id_torneio === torneio.id_torneio) && p.id_modalidade === idModalidade).sort((a, b) => Number(a.ordem) - Number(b.ordem)).map(p => Object.assign({}, p, {
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
    let placar; let desempate = {};
    if (partida.id_modalidade === 'bocha_48' && Number(payload.placar_a) === Number(payload.placar_b)) {
      const a = Number(payload.placar_a); const b = Number(payload.placar_b); if (!Number.isInteger(a) || a < 0 || a > 48 || !Number.isInteger(b) || b < 0 || b > 48) throw new Error('Placar regulamentar inválido para Bocha 48.');
      const decisao = validarDesempateBocha48_(a, b, payload.rodadas_desempate); if (!decisao.vencedor) throw new Error(`Empate pendente: realize ${decisao.pendente}.`);
      const ultima = payload.rodadas_desempate[decisao.rodada - 1]; placar = { placar_a: a, placar_b: b }; desempate = { pontos_desempate_a: Number(ultima.pontos_a), pontos_desempate_b: Number(ultima.pontos_b), tipo_desempate: decisao.tipo };
    } else placar = validarPlacarModalidade(partida.id_modalidade, payload.placar_a, payload.placar_b);
    const result = dbUpdateUnsafe_('tb_partidas', 'id_partida', partida.id_partida, Object.assign({}, placar, desempate, { status_partida: 'FINALIZADO', data_atualizacao: getISODate() }));
    if (!result.success) throw new Error(result.error);
    processarPontuacaoGeralUnsafe_();
    return { id_partida: partida.id_partida };
  }));
}

function apiGetClassificacaoGeral() { return apiResponse_(() => { const torneio = dbRead('tb_torneios')[0]; return getRankingEficiencia_(torneio && torneio.id_torneio); }); }
function processarPontuacaoGeral() { return withDatabaseLock_(() => { const torneio = dbRead('tb_torneios')[0]; return torneio ? recalcularTrofeuEficienciaUnsafe_(torneio.id_torneio) : 0; }); }

function processarPontuacaoGeralUnsafe_() {
  const torneio = dbRead('tb_torneios')[0];
  return { registros: torneio ? recalcularTrofeuEficienciaUnsafe_(torneio.id_torneio) : 0 };
}

function apiResponse_(callback) { try { return { success: true, data: callback() }; } catch (error) { console.error(error); return { success: false, error: error.message || String(error) }; } }
function requiredText_(value, label, max) { const text = String(value || '').trim(); if (!text) throw new Error(`${label} é obrigatório.`); if (text.length > max) throw new Error(`${label} deve ter no máximo ${max} caracteres.`); return text; }
function optionalText_(value, max) { const text = String(value || '').trim(); if (text.length > max) throw new Error(`Campo deve ter no máximo ${max} caracteres.`); return text; }
function normalize_(value) { return String(value || '').trim().toLocaleLowerCase('pt-BR'); }
function shuffle_(items) { const result = items.slice(); for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; } return result; }
