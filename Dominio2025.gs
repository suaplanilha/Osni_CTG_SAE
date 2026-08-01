/** Regras consolidadas do Regulamento de Esportes Campeiros 2025. */
const REGULAMENTO_2025 = Object.freeze({
  composicao: Object.freeze({
    tava: { minimo: 3, maximo: 4, titulares: 4, reservaMax: 0 },
    bocha_campeira: { minimo: 3, maximo: 4, titulares: 3, reservaMax: 1 },
    tetarfe: { minimo: 1, maximo: 4, titulares: 4, reservaMax: 0 },
    truco: { minimo: 3, maximo: 4, titulares: 3, reservaMax: 1 },
    truco_cego: { minimo: 3, maximo: 4, titulares: 3, reservaMax: 1 },
    bocha_48: { minimo: 2, maximo: 3, titulares: 3, reservaMax: 0 }
  }),
  eficiencia: Object.freeze({ 1: 10, 2: 8, 3: 6, 4: 5, 5: 4, participacao: 2 }),
  conclusoesSemPontos: Object.freeze(['WO', 'DESCLASSIFICADO', 'DESISTENTE', 'AUSENTE', 'NAO_CONCLUIU'])
});

function apiGetContextoAdministrativo() {
  return apiResponse_(() => {
    const torneios = dbRead('tb_torneios');
    const torneio = torneios.find(item => item.status !== 'ENCERRADO') || torneios[0] || null;
    const inscricoes = dbRead('tb_inscricoes');
    const equipes = dbRead('tb_equipes').map(equipe => { const inscricao = inscricoes.find(item => item.id_equipe === equipe.id_equipe); return Object.assign({}, equipe, { id_modalidade: inscricao ? inscricao.id_modalidade : '', situacao_conclusao: inscricao ? inscricao.situacao_conclusao : 'PENDENTE' }); });
    return { torneio, entidades: dbRead('tb_entidades'), atletas: enriquecerAtletas_(torneio && torneio.id_torneio), equipes, regulamento: REGULAMENTO_2025 };
  });
}

function apiGetInscricoesOperacionais() {
  return apiResponse_(() => {
    const contexto = apiGetContextoAdministrativo(); if (!contexto.success) throw new Error(contexto.error);
    const torneio = contexto.data.torneio; const habilitacoes = torneio ? dbRead('tb_habilitacoes_modalidades', true).filter(item => item.id_torneio === torneio.id_torneio) : [];
    const integrantes = dbRead('tb_equipe_atletas');
    return contexto.data.atletas.map(atleta => {
      const toggles = {}; MODALIDADES.forEach(mod => { const row = habilitacoes.find(item => item.id_atleta === atleta.id_atleta && item.id_modalidade === mod.id_modalidade); toggles[mod.id_modalidade] = Boolean(row && normalizeBoolean_(row.habilitado)); });
      return Object.assign({}, atleta, { modalidades: toggles, equipes_count: integrantes.filter(item => item.id_atleta === atleta.id_atleta).length });
    });
  });
}

function apiSalvarInscricaoOperacional(payload) {
  return apiResponse_(() => withDatabaseLock_(() => {
    payload = payload || {}; const torneio = obterTorneio_(payload.id_torneio); const entidade = obterEntidadeRegular_(payload.id_entidade); const now = getISODate();
    const nome = requiredText_(payload.nome_atleta, 'Nome do atleta', 140); const telefone = normalizarTelefone_(requiredText_(payload.telefone, 'Telefone', 30));
    let atleta = payload.id_atleta ? dbRead('tb_atletas', true).find(item => item.id_atleta === payload.id_atleta) : null;
    if (payload.id_atleta && !atleta) throw new Error('Atleta não encontrado.');
    if (atleta) {
      const vinculoAtual = dbRead('tb_vinculos_atletas', true).find(item => item.id_torneio === torneio.id_torneio && item.id_atleta === atleta.id_atleta);
      if (vinculoAtual && vinculoAtual.id_entidade !== entidade.id_entidade) validarMudancaEntidade_(torneio.id_torneio, atleta.id_atleta);
      const habilitacoesAtuais = dbRead('tb_habilitacoes_modalidades', true).filter(item => item.id_torneio === torneio.id_torneio && item.id_atleta === atleta.id_atleta && normalizeBoolean_(item.habilitado));
      habilitacoesAtuais.forEach(item => { if (!payload.modalidades || !payload.modalidades[item.id_modalidade]) validarDesabilitacaoModalidade_(torneio.id_torneio, atleta.id_atleta, item.id_modalidade); });
    }
    const duplicado = dbRead('tb_atletas').find(item => item.nome_normalizado === normalize_(nome) && item.telefone_normalizado === telefone && (!atleta || item.id_atleta !== atleta.id_atleta));
    if (duplicado) throw new Error('Já existe um atleta com este nome e telefone.');
    if (atleta) {
      const result = dbUpdateUnsafe_('tb_atletas', 'id_atleta', atleta.id_atleta, { nome_atleta: nome, telefone, nome_normalizado: normalize_(nome), telefone_normalizado: telefone, ativo: true, data_atualizacao: now }); if (!result.success) throw new Error(result.error);
    } else {
      atleta = { id_atleta: generateUUID(), nome_atleta: nome, telefone, nome_normalizado: normalize_(nome), telefone_normalizado: telefone, data_criacao: now, data_atualizacao: now, ativo: true }; dbInsertUnsafe_('tb_atletas', atleta);
    }
    const vinculo = dbRead('tb_vinculos_atletas', true).find(item => item.id_torneio === torneio.id_torneio && item.id_atleta === atleta.id_atleta);
    if (vinculo && vinculo.id_entidade !== entidade.id_entidade) validarMudancaEntidade_(torneio.id_torneio, atleta.id_atleta);
    if (vinculo) dbUpdateUnsafe_('tb_vinculos_atletas', 'id_vinculo', vinculo.id_vinculo, { id_entidade: entidade.id_entidade, ativo: true, data_atualizacao: now });
    else dbInsertUnsafe_('tb_vinculos_atletas', { id_vinculo: generateUUID(), id_torneio: torneio.id_torneio, id_atleta: atleta.id_atleta, id_entidade: entidade.id_entidade, data_vinculo: now, data_atualizacao: now, ativo: true });
    MODALIDADES.forEach(mod => upsertHabilitacao_(torneio.id_torneio, atleta.id_atleta, mod.id_modalidade, Boolean(payload.modalidades && payload.modalidades[mod.id_modalidade]), now));
    registrarAuditoria_({ id_torneio: torneio.id_torneio, entidade: 'ATLETA', id_registro: atleta.id_atleta, acao: payload.id_atleta ? 'EDITAR' : 'CADASTRAR', dados_novos: payload });
    return Object.assign({}, atleta, { id_entidade: entidade.id_entidade });
  }));
}

function apiInativarAtleta(payload) {
  return apiResponse_(() => withDatabaseLock_(() => {
    payload = payload || {}; const torneio = obterTorneio_(payload.id_torneio); const atleta = dbRead('tb_atletas').find(item => item.id_atleta === payload.id_atleta); if (!atleta) throw new Error('Atleta não encontrado.');
    validarMudancaEntidade_(torneio.id_torneio, atleta.id_atleta); const now = getISODate();
    dbUpdateUnsafe_('tb_atletas', 'id_atleta', atleta.id_atleta, { ativo: false, data_atualizacao: now });
    dbRead('tb_habilitacoes_modalidades').filter(item => item.id_torneio === torneio.id_torneio && item.id_atleta === atleta.id_atleta).forEach(item => dbUpdateUnsafe_('tb_habilitacoes_modalidades', 'id_habilitacao', item.id_habilitacao, { habilitado: false, ativo: false, data_atualizacao: now }));
    registrarAuditoria_({ id_torneio: torneio.id_torneio, entidade: 'ATLETA', id_registro: atleta.id_atleta, acao: 'INATIVAR', motivo: payload.motivo || '' }); return { id_atleta: atleta.id_atleta };
  }));
}

function apiGetPainelModalidade(idModalidade) {
  return apiResponse_(() => {
    if (!getModalidadeRegra(idModalidade)) throw new Error('Modalidade inválida.'); const torneio = obterTorneio_();
    const inscricoes = dbRead('tb_inscricoes').filter(item => item.id_torneio === torneio.id_torneio && item.id_modalidade === idModalidade);
    const ids = new Set(inscricoes.map(item => item.id_equipe)); const atletas = {}; dbRead('tb_atletas', true).forEach(item => { atletas[item.id_atleta] = item.nome_atleta; }); const integrantes = dbRead('tb_equipe_atletas');
    const equipes = dbRead('tb_equipes').filter(item => ids.has(item.id_equipe)).map(item => Object.assign({}, item, { atletas: integrantes.filter(integrante => integrante.id_equipe === item.id_equipe).sort((a, b) => Number(a.ordem) - Number(b.ordem)).map(integrante => ({ id_atleta: integrante.id_atleta, nome_atleta: atletas[integrante.id_atleta] || 'Atleta', papel: integrante.papel })) }));
    const partidas = apiGetPartidasPorModalidade(idModalidade); if (!partidas.success) throw new Error(partidas.error);
    const provisoria = calcularRankingProvisorio_(equipes, partidas.data); const homologada = dbRead('tb_classificacoes_modalidade').filter(item => item.id_torneio === torneio.id_torneio && item.id_modalidade === idModalidade && item.status_homologacao === 'HOMOLOGADA').sort((a, b) => Number(a.colocacao) - Number(b.colocacao));
    return { modalidade: getModalidadeRegra(idModalidade), equipes, partidas: partidas.data, ranking_provisorio: provisoria, ranking_homologado: homologada, status: homologada.length ? 'HOMOLOGADA' : (partidas.data.some(item => item.status_partida === 'FINALIZADO') ? 'EM_ANDAMENTO' : 'CONFIGURACAO') };
  });
}

function upsertHabilitacao_(idTorneio, idAtleta, idModalidade, habilitado, now) {
  const row = dbRead('tb_habilitacoes_modalidades', true).find(item => item.id_torneio === idTorneio && item.id_atleta === idAtleta && item.id_modalidade === idModalidade);
  if (row) { if (normalizeBoolean_(row.habilitado) && !habilitado) validarDesabilitacaoModalidade_(idTorneio, idAtleta, idModalidade); dbUpdateUnsafe_('tb_habilitacoes_modalidades', 'id_habilitacao', row.id_habilitacao, { habilitado, ativo: true, data_atualizacao: now }); }
  else dbInsertUnsafe_('tb_habilitacoes_modalidades', { id_habilitacao: generateUUID(), id_torneio: idTorneio, id_atleta: idAtleta, id_modalidade: idModalidade, habilitado, data_atualizacao: now, ativo: true });
}

function validarDesabilitacaoModalidade_(idTorneio, idAtleta, idModalidade) { const membro = dbRead('tb_equipe_atletas').find(item => item.id_torneio === idTorneio && item.id_atleta === idAtleta && item.id_modalidade === idModalidade); if (membro) throw new Error('O atleta já compõe uma equipe nesta modalidade. Remova-o da equipe antes de desabilitar.'); }
function validarMudancaEntidade_(idTorneio, idAtleta) { const equipes = dbRead('tb_equipe_atletas').filter(item => item.id_torneio === idTorneio && item.id_atleta === idAtleta).map(item => item.id_equipe); if (dbRead('tb_partidas', true).some(item => equipes.includes(item.id_equipe_a) || equipes.includes(item.id_equipe_b))) throw new Error('A entidade não pode ser alterada porque o atleta já possui partidas.'); if (equipes.length) throw new Error('Remova o atleta das equipes antes de mudar a entidade ou inativá-lo.'); }
function calcularRankingProvisorio_(equipes, partidas) { const map = {}; equipes.forEach(item => { map[item.id_equipe] = { id_equipe: item.id_equipe, nome_equipe: item.nome_equipe, entidade: item.entidade_responsavel, pontos: 0, vitorias: 0, jogos: 0 }; }); partidas.filter(item => item.status_partida === 'FINALIZADO').forEach(item => { const a = map[item.id_equipe_a]; const b = map[item.id_equipe_b]; if (a) { a.pontos += Number(item.placar_a || 0); a.jogos++; if (Number(item.placar_a) > Number(item.placar_b)) a.vitorias++; } if (b) { b.pontos += Number(item.placar_b || 0); b.jogos++; if (Number(item.placar_b) > Number(item.placar_a)) b.vitorias++; } }); return Object.values(map).sort((a, b) => b.vitorias - a.vitorias || b.pontos - a.pontos || a.nome_equipe.localeCompare(b.nome_equipe, 'pt-BR')); }

function apiSalvarEntidade(payload) {
  return apiResponse_(() => withDatabaseLock_(() => {
    payload = payload || {}; const now = getISODate();
    const nome = requiredText_(payload.nome_entidade, 'Nome da entidade/piquete', 140);
    if (dbRead('tb_entidades').some(item => normalize_(item.nome_entidade) === normalize_(nome))) throw new Error('Esta entidade já está cadastrada.');
    const entidade = { id_entidade: generateUUID(), nome_entidade: nome, telefone: normalizarTelefone_(payload.telefone), responsavel: optionalText_(payload.responsavel, 120), status_regularidade: payload.status_regularidade === 'IRREGULAR' ? 'IRREGULAR' : 'REGULAR', data_criacao: now, data_atualizacao: now, ativo: true };
    dbInsertUnsafe_('tb_entidades', entidade); return entidade;
  }));
}

function apiSalvarAtleta(payload) {
  return apiResponse_(() => withDatabaseLock_(() => {
    payload = payload || {}; const now = getISODate();
    const nome = requiredText_(payload.nome_atleta, 'Nome do atleta', 140);
    const telefone = normalizarTelefone_(requiredText_(payload.telefone, 'Telefone', 30));
    const torneio = obterTorneio_(payload.id_torneio); const entidade = obterEntidadeRegular_(payload.id_entidade);
    const nomeNormalizado = normalize_(nome);
    let atleta = dbRead('tb_atletas').find(item => item.nome_normalizado === nomeNormalizado && item.telefone_normalizado === telefone);
    if (!atleta) {
      atleta = { id_atleta: generateUUID(), nome_atleta: nome, telefone, nome_normalizado: nomeNormalizado, telefone_normalizado: telefone, data_criacao: now, data_atualizacao: now, ativo: true };
      dbInsertUnsafe_('tb_atletas', atleta);
    }
    const vinculoExistente = dbRead('tb_vinculos_atletas').find(item => item.id_torneio === torneio.id_torneio && item.id_atleta === atleta.id_atleta);
    if (vinculoExistente && vinculoExistente.id_entidade !== entidade.id_entidade) throw new Error('O atleta já representa outra entidade neste torneio.');
    if (!vinculoExistente) dbInsertUnsafe_('tb_vinculos_atletas', { id_vinculo: generateUUID(), id_torneio: torneio.id_torneio, id_atleta: atleta.id_atleta, id_entidade: entidade.id_entidade, data_vinculo: now, data_atualizacao: now, ativo: true });
    return atleta;
  }));
}

function apiCadastrarEquipeRegulamentar(payload) {
  return apiResponse_(() => withDatabaseLock_(() => {
    payload = payload || {}; const now = getISODate();
    const torneio = obterTorneio_(payload.id_torneio); const entidade = obterEntidadeRegular_(payload.id_entidade);
    const modalidade = getModalidadeRegra(payload.id_modalidade); if (!modalidade) throw new Error('Modalidade inválida.');
    const ids = Array.from(new Set(Array.isArray(payload.ids_atletas) ? payload.ids_atletas.map(String) : []));
    const regra = validarComposicaoEquipe_(modalidade.id_modalidade, ids);
    const vinculos = dbRead('tb_vinculos_atletas').filter(item => item.id_torneio === torneio.id_torneio && ids.includes(String(item.id_atleta)));
    if (vinculos.length !== ids.length || vinculos.some(item => item.id_entidade !== entidade.id_entidade)) throw new Error('Todos os atletas devem representar a entidade selecionada neste torneio.');
    const habilitados = dbRead('tb_habilitacoes_modalidades').filter(item => item.id_torneio === torneio.id_torneio && item.id_modalidade === modalidade.id_modalidade && ids.includes(String(item.id_atleta)) && normalizeBoolean_(item.habilitado));
    if (habilitados.length !== ids.length) throw new Error('Todos os atletas devem estar habilitados nesta modalidade.');
    const equipe = { id_equipe: generateUUID(), id_torneio: torneio.id_torneio, id_entidade: entidade.id_entidade, nome_equipe: requiredText_(payload.nome_equipe, 'Nome da equipe/ficha', 120), entidade_responsavel: entidade.nome_entidade, contato: '', status_equipe: 'CONFIRMADA', data_criacao: now, data_atualizacao: now, ativo: true };
    dbInsertUnsafe_('tb_equipes', equipe);
    ids.forEach((idAtleta, index) => dbInsertUnsafe_('tb_equipe_atletas', { id_integrante: generateUUID(), id_torneio: torneio.id_torneio, id_equipe: equipe.id_equipe, id_atleta: idAtleta, id_modalidade: modalidade.id_modalidade, papel: index < regra.titulares ? 'TITULAR' : 'RESERVA', ordem: index + 1, data_criacao: now, data_atualizacao: now, ativo: true }));
    dbInsertUnsafe_('tb_inscricoes', { id_inscricao: generateUUID(), id_torneio: torneio.id_torneio, id_equipe: equipe.id_equipe, id_modalidade: modalidade.id_modalidade, status: 'CONFIRMADA', situacao_conclusao: 'PENDENTE', data_inscricao: now, data_atualizacao: now, ativo: true });
    return equipe;
  }));
}

function apiHomologarClassificacao(payload) {
  return apiResponse_(() => withDatabaseLock_(() => {
    payload = payload || {}; const torneio = obterTorneio_(payload.id_torneio);
    if (!getModalidadeRegra(payload.id_modalidade)) throw new Error('Modalidade inválida.');
    if (dbRead('tb_classificacoes_modalidade').some(item => item.id_torneio === torneio.id_torneio && item.id_modalidade === payload.id_modalidade && item.status_homologacao === 'HOMOLOGADA')) throw new Error('A modalidade já está homologada. Reabra-a antes de corrigir.');
    const entries = Array.isArray(payload.classificacao) ? payload.classificacao : [];
    if (!entries.length) throw new Error('Informe a classificação final da modalidade.');
    const posicoes = new Set(); const equipes = dbRead('tb_equipes'); const inscricoes = dbRead('tb_inscricoes'); const now = getISODate();
    entries.forEach(item => {
      const posicao = Number(item.colocacao); if (!Number.isInteger(posicao) || posicao < 1 || posicoes.has(posicao)) throw new Error('As colocações devem ser inteiras, positivas e únicas.'); posicoes.add(posicao);
      const equipe = equipes.find(eq => eq.id_equipe === item.id_equipe && eq.id_torneio === torneio.id_torneio); if (!equipe) throw new Error('Equipe inválida na classificação.');
      if (!inscricoes.some(inscricao => inscricao.id_equipe === equipe.id_equipe && inscricao.id_modalidade === payload.id_modalidade && ['CONFIRMADA', 'CONFIRMADO', 'CONCLUIDA'].includes(inscricao.status))) throw new Error('Equipe não inscrita nesta modalidade.');
      const situacao = normalizarConclusao_(item.situacao_conclusao);
      dbInsertUnsafe_('tb_classificacoes_modalidade', { id_classificacao: generateUUID(), id_torneio: torneio.id_torneio, id_modalidade: payload.id_modalidade, id_equipe: equipe.id_equipe, id_entidade: equipe.id_entidade, colocacao: posicao, pontos_tecnicos: Number(item.pontos_tecnicos || 0), vitorias: Number(item.vitorias || 0), situacao_conclusao: situacao, status_homologacao: 'HOMOLOGADA', versao: 1, observacao: optionalText_(payload.observacao, 1000), data_homologacao: now, data_atualizacao: now, ativo: true });
    });
    recalcularTrofeuEficienciaUnsafe_(torneio.id_torneio); registrarAuditoria_({ id_torneio: torneio.id_torneio, entidade: 'CLASSIFICACAO_MODALIDADE', id_registro: payload.id_modalidade, acao: 'HOMOLOGAR', motivo: payload.observacao || '', dados_novos: entries });
    return { homologados: entries.length };
  }));
}

function apiReabrirClassificacao(payload) {
  return apiResponse_(() => withDatabaseLock_(() => {
    payload = payload || {}; const motivo = requiredText_(payload.motivo, 'Motivo da reabertura', 1000); const torneio = obterTorneio_(payload.id_torneio); const now = getISODate();
    const rows = dbRead('tb_classificacoes_modalidade').filter(item => item.id_torneio === torneio.id_torneio && item.id_modalidade === payload.id_modalidade && item.status_homologacao === 'HOMOLOGADA');
    if (!rows.length) throw new Error('Não existe classificação homologada para reabrir.');
    rows.forEach(item => dbUpdateUnsafe_('tb_classificacoes_modalidade', 'id_classificacao', item.id_classificacao, { status_homologacao: 'REABERTA', ativo: false, data_atualizacao: now }));
    registrarAuditoria_({ id_torneio: torneio.id_torneio, entidade: 'CLASSIFICACAO_MODALIDADE', id_registro: payload.id_modalidade, acao: 'REABRIR', motivo, dados_anteriores: rows });
    recalcularTrofeuEficienciaUnsafe_(torneio.id_torneio); return { reabertos: rows.length };
  }));
}

function recalcularTrofeuEficienciaUnsafe_(idTorneio) {
  const todas = dbRead('tb_classificacoes_modalidade').filter(item => item.id_torneio === idTorneio && item.status_homologacao === 'HOMOLOGADA');
  const vistosTetarfe = new Set();
  const classificacoes = todas.sort((a, b) => Number(a.colocacao) - Number(b.colocacao)).filter(item => { if (item.id_modalidade !== 'tetarfe') return true; if (vistosTetarfe.has(item.id_entidade)) return false; vistosTetarfe.add(item.id_entidade); return true; });
  const entidades = {}; dbRead('tb_entidades', true).forEach(item => { entidades[item.id_entidade] = item.nome_entidade; });
  const resumo = {};
  classificacoes.forEach(item => {
    if (!resumo[item.id_entidade]) resumo[item.id_entidade] = { pontos: 0, primeiros: 0, segundos: 0, terceiros: 0 };
    const posicao = Number(item.colocacao); const invalida = REGULAMENTO_2025.conclusoesSemPontos.includes(item.situacao_conclusao);
    const pontos = invalida ? 0 : (REGULAMENTO_2025.eficiencia[posicao] || (item.situacao_conclusao === 'CONCLUIDA' ? REGULAMENTO_2025.eficiencia.participacao : 0));
    resumo[item.id_entidade].pontos += pontos; if (!invalida && posicao === 1) resumo[item.id_entidade].primeiros++; if (!invalida && posicao === 2) resumo[item.id_entidade].segundos++; if (!invalida && posicao === 3) resumo[item.id_entidade].terceiros++;
  });
  const sheet = getSheet_('tb_pontuacao_geral'); if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
  const rows = Object.keys(resumo).map(id => ({ id_registro: generateUUID(), id_torneio: idTorneio, id_entidade: id, entidade: entidades[id] || 'Entidade', pontos_totais: resumo[id].pontos, primeiros_lugares: resumo[id].primeiros, segundos_lugares: resumo[id].segundos, terceiros_lugares: resumo[id].terceiros, status_desempate: 'RESOLVIDO', observacao: '', ultima_atualizacao: getISODate() }));
  rows.forEach(row => dbInsertUnsafe_('tb_pontuacao_geral', row)); return rows.length;
}

function getRankingEficiencia_(idTorneio) { return dbRead('tb_pontuacao_geral').filter(item => !idTorneio || item.id_torneio === idTorneio).sort((a, b) => Number(b.pontos_totais) - Number(a.pontos_totais) || Number(b.primeiros_lugares) - Number(a.primeiros_lugares) || Number(b.segundos_lugares) - Number(a.segundos_lugares) || Number(b.terceiros_lugares) - Number(a.terceiros_lugares) || String(a.entidade).localeCompare(String(b.entidade), 'pt-BR')); }
function validarComposicaoEquipe_(id, ids) { const regra = REGULAMENTO_2025.composicao[id]; if (!regra) throw new Error('Modalidade sem regra de composição.'); if (ids.length < regra.minimo || ids.length > regra.maximo) throw new Error(`A modalidade exige de ${regra.minimo} a ${regra.maximo} atletas.`); return regra; }
function obterTorneio_(id) { const item = dbRead('tb_torneios').find(t => t.id_torneio === id) || (!id ? dbRead('tb_torneios')[0] : null); if (!item) throw new Error('Torneio inválido.'); return item; }
function obterEntidadeRegular_(id) { const item = dbRead('tb_entidades').find(entidade => entidade.id_entidade === id); if (!item) throw new Error('Entidade inválida.'); if (item.status_regularidade !== 'REGULAR') throw new Error('A entidade não está regular para inscrições.'); return item; }
function normalizarTelefone_(value) { const digits = String(value || '').replace(/\D/g, ''); if (digits.length < 10 || digits.length > 13) throw new Error('Informe um telefone válido com DDD.'); return digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits; }
function normalizarConclusao_(value) { const allowed = ['CONCLUIDA'].concat(REGULAMENTO_2025.conclusoesSemPontos); return allowed.includes(value) ? value : 'CONCLUIDA'; }
function enriquecerAtletas_(idTorneio) { const vinculos = dbRead('tb_vinculos_atletas', true).filter(v => !idTorneio || v.id_torneio === idTorneio); const entidades = {}; dbRead('tb_entidades', true).forEach(c => { entidades[c.id_entidade] = c.nome_entidade; }); return dbRead('tb_atletas', true).map(a => { const v = vinculos.find(item => item.id_atleta === a.id_atleta); return Object.assign({}, a, { id_entidade: v ? v.id_entidade : '', nome_entidade: v ? entidades[v.id_entidade] : '' }); }); }
function registrarAuditoria_(data) { const now = getISODate(); dbInsertUnsafe_('tb_auditoria', { id_auditoria: generateUUID(), id_torneio: data.id_torneio || '', entidade: data.entidade, id_registro: data.id_registro, acao: data.acao, dados_anteriores: JSON.stringify(data.dados_anteriores || null), dados_novos: JSON.stringify(data.dados_novos || null), motivo: data.motivo || '', administrador: Session.getActiveUser().getEmail() || 'admin', data_evento: now }); }

function calcularTavaEquipe_(atletas) {
  if (!Array.isArray(atletas) || atletas.length < 3 || atletas.length > 4) throw new Error('Tava exige de 3 a 4 atletas.');
  const tipos = { SORTE_CLAVADA: 2, SORTE_CORRIDA: 1, NEUTRO: 0, CULO_CORRIDO: -1, CULO_CLAVADO: -2 };
  const resultados = atletas.map(atleta => {
    if (!Array.isArray(atleta.jogadas) || atleta.jogadas.length !== 10) throw new Error('Cada atleta da Tava deve possuir 10 jogadas.');
    const metricas = { sorte_clavada: 0, sorte_corrida: 0, culo_clavado: 0, culo_corrido: 0 };
    const total = atleta.jogadas.reduce((soma, jogada) => { if (!(jogada in tipos)) throw new Error('Jogada de Tava inválida.'); const key = String(jogada).toLowerCase(); if (metricas[key] !== undefined) metricas[key]++; return soma + tipos[jogada]; }, 0);
    return { id_atleta: atleta.id_atleta, total, metricas };
  }).sort((a, b) => b.total - a.total);
  const computados = resultados.slice(0, 3); return { total: computados.reduce((s, item) => s + item.total, 0), computados, descartado: resultados[3] || null };
}

function compararTava_(a, b) {
  const criterios = [['sorte_clavada', -1], ['sorte_corrida', -1], ['culo_clavado', 1], ['culo_corrido', 1]];
  if (a.total !== b.total) return a.total > b.total ? -1 : 1;
  for (let i = 0; i < criterios.length; i++) { const key = criterios[i][0]; const direction = criterios[i][1]; const av = Number(a.metricas[key] || 0); const bv = Number(b.metricas[key] || 0); if (av !== bv) return av > bv ? direction : -direction; }
  return 0;
}

function validarDesempateBocha48_(placarA, placarB, rodadas) {
  if (Number(placarA) !== Number(placarB)) return { vencedor: Number(placarA) > Number(placarB) ? 'A' : 'B', rodada: 0 };
  if (!Array.isArray(rodadas) || !rodadas.length) return { vencedor: null, pendente: 'CARAMBOLA' };
  for (let i = 0; i < rodadas.length; i++) { const a = Number(rodadas[i].pontos_a); const b = Number(rodadas[i].pontos_b); if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) throw new Error('Pontuação de desempate inválida.'); if (a !== b) return { vencedor: a > b ? 'A' : 'B', rodada: i + 1, tipo: i === 0 ? 'CARAMBOLA' : 'TIRO_DE_OURO' }; }
  return { vencedor: null, pendente: 'TIRO_DE_OURO', rodada: rodadas.length + 1 };
}

function calcularTetarfeEquipe_(atletas) {
  if (!Array.isArray(atletas) || atletas.length < 1 || atletas.length > 4) throw new Error('Tetarfe exige de 1 a 4 atletas.');
  const totais = atletas.map(item => Number(item.total)); if (totais.some(item => !Number.isFinite(item))) throw new Error('Pontuação individual de Tetarfe inválida.');
  totais.sort((a, b) => b - a); return { total: totais.reduce((s, n) => s + n, 0), maior_individual: totais[0], segundo_melhor: totais[1] === undefined ? 0 : totais[1], totais };
}

function validarQuedasTruco_(quedas) {
  if (!Array.isArray(quedas) || quedas.length < 2 || quedas.length > 3) throw new Error('O Truco é disputado em melhor de três quedas.');
  let a = 0; let b = 0;
  quedas.forEach((queda, index) => { const pa = Number(queda.pontos_a); const pb = Number(queda.pontos_b); if (!Number.isInteger(pa) || !Number.isInteger(pb) || pa < 0 || pb < 0 || pa > 12 || pb > 12 || pa === pb || Math.max(pa, pb) !== 12) throw new Error(`Resultado inválido na queda ${index + 1}.`); if (pa > pb) a++; else b++; });
  if (a < 2 && b < 2) throw new Error('O confronto ainda não possui vencedor.'); if (quedas.length === 3 && (a === 2 || b === 2) && ((quedas[0].pontos_a > quedas[0].pontos_b) === (quedas[1].pontos_a > quedas[1].pontos_b))) throw new Error('A terceira queda não deve existir após duas vitórias consecutivas.');
  return { quedas_a: a, quedas_b: b, vencedor: a > b ? 'A' : 'B' };
}
