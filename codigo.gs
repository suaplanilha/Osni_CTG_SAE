/**
 * CONTROLLER PRINCIPAL / ENDPOINTS DA API (PADRÃO SAE)
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Sistema de Torneios Campeiros - SAE')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/* ==========================================================================
   1. ENDPOINTS DE EQUIPES E INSCRIÇÕES
   ========================================================================== */

/**
 * Retorna a lista de todas as equipes cadastradas.
 */
function apiGetEquipes() {
  try {
    const dados = dbRead('tb_equipes');
    return { success: true, data: dados };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Cadastra uma nova equipe e realiza sua inscrição inicial.
 */
function apiCadastrarInscrito(payload) {
  try {
    // 1. Insere a Equipe na tb_equipes
    const novaEquipe = {
      id_equipe: generateUUID(),
      nome_equipe: payload.nome,
      ctg_responsavel: payload.ctg,
      contato: payload.contato || '',
      data_criacao: getISODate(),
      ativo: true
    };
    
    const resEquipe = dbInsert('tb_equipes', novaEquipe);
    if (!resEquipe.success) throw new Error(resEquipe.error);

    // 2. Insere a Inscrição na tb_inscricoes
    const novaInscricao = {
      id_inscricao: generateUUID(),
      id_equipe: novaEquipe.id_equipe,
      id_modalidade: payload.id_modalidade,
      status: 'CONFIRMADO',
      data_inscricao: getISODate()
    };
    
    const resInscricao = dbInsert('tb_inscricoes', novaInscricao);
    if (!resInscricao.success) throw new Error(resInscricao.error);

    return { success: true, data: novaEquipe };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/* ==========================================================================
   2. ENDPOINTS DE CONFRONTOS E SÚMULAS
   ========================================================================== */

/**
 * Retorna as partidas de uma modalidade específica.
 */
function apiGetPartidasPorModalidade(idModalidade) {
  try {
    const partidas = dbRead('tb_partidas');
    const filtradas = partidas.filter(p => p.id_modalidade === idModalidade);
    return { success: true, data: filtradas };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Atualiza o placar e encerra um confronto na tb_partidas.
 */
function apiSalvarResultadoPartida(payload) {
  try {
    const dadosAtualizados = {
      placar_a: payload.placar_a,
      placar_b: payload.placar_b,
      status_partida: 'FINALIZADO',
      data_atualizacao: getISODate()
    };

    const res = dbUpdate('tb_partidas', 'id_partida', payload.id_partida, dadosAtualizados);
    if (!res.success) throw new Error(res.error);

    // Recalcula o ranking do Campeão Geral após cada partida encerrada
    processarPontuacaoGeral();

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/* ==========================================================================
   3. ENDPOINT DE APURAÇÃO DO CAMPEÃO GERAL
   ========================================================================== */

/**
 * Lê e consolida a tabela de classificação geral.
 */
function apiGetClassificacaoGeral() {
  try {
    const ranking = dbRead('tb_pontuacao_geral');
    // Ordena por maior pontuação
    ranking.sort((a, b) => b.pontos_totais - a.pontos_totais);
    return { success: true, data: ranking };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Processa e consolida os pontos na tb_pontuacao_geral (Job Interno)
 */
function processarPontuacaoGeral() {
  const partidas = dbRead('tb_partidas');
  const equipes = dbRead('tb_equipes');
  
  const mapaEquipes = {};
  equipes.forEach(eq => { mapaEquipes[eq.id_equipe] = eq.ctg_responsavel; });

  const mapaCTG = {};

  partidas.forEach(p => {
    if (p.status_partida !== 'FINALIZADO') return;

    const ctgA = mapaEquipes[p.id_equipe_a];
    const ctgB = mapaEquipes[p.id_equipe_b];

    if (ctgA) {
      if (!mapaCTG[ctgA]) mapaCTG[ctgA] = { pontos: 0, vitorias: 0 };
      mapaCTG[ctgA].pontos += Number(p.placar_a || 0);
      if (Number(p.placar_a) > Number(p.placar_b)) mapaCTG[ctgA].vitorias += 1;
    }

    if (ctgB) {
      if (!mapaCTG[ctgB]) mapaCTG[ctgB] = { pontos: 0, vitorias: 0 };
      mapaCTG[ctgB].pontos += Number(p.placar_b || 0);
      if (Number(p.placar_b) > Number(p.placar_a)) mapaCTG[ctgB].vitorias += 1;
    }
  });

  // Atualiza ou Insere na tb_pontuacao_geral
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('tb_pontuacao_geral');
  sheet.getRange('A2:E' + sheet.getLastRow()).clearContent(); // Limpa e reescreve

  const novasLinhas = Object.keys(mapaCTG).map(ctg => [
    generateUUID(),
    ctg,
    mapaCTG[ctg].pontos,
    mapaCTG[ctg].vitorias,
    getISODate()
  ]);

  if (novasLinhas.length > 0) {
    sheet.getRange(2, 1, novasLinhas.length, 5).setValues(novasLinhas);
  }
}
