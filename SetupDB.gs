/** Configuração e migração idempotente do banco Google Sheets. */
const DB_SCHEMAS = Object.freeze({
  TORNEIOS: { name: 'tb_torneios', headers: ['id_torneio', 'nome_torneio', 'ano', 'status', 'data_inicio', 'data_fim', 'data_criacao', 'data_atualizacao', 'ativo'] },
  CTGS: { name: 'tb_ctgs', headers: ['id_ctg', 'nome_ctg', 'mtg_federacao', 'telefone', 'status_regularidade', 'data_criacao', 'data_atualizacao', 'ativo'] },
  ATLETAS: { name: 'tb_atletas', headers: ['id_atleta', 'nome_atleta', 'telefone', 'nome_normalizado', 'telefone_normalizado', 'data_criacao', 'data_atualizacao', 'ativo'] },
  VINCULOS_ATLETAS: { name: 'tb_vinculos_atletas', headers: ['id_vinculo', 'id_torneio', 'id_atleta', 'id_ctg', 'data_vinculo', 'data_atualizacao', 'ativo'] },
  EQUIPES: { name: 'tb_equipes', headers: ['id_equipe', 'id_torneio', 'id_ctg', 'nome_equipe', 'ctg_responsavel', 'contato', 'status_equipe', 'data_criacao', 'data_atualizacao', 'ativo'] },
  EQUIPE_ATLETAS: { name: 'tb_equipe_atletas', headers: ['id_integrante', 'id_torneio', 'id_equipe', 'id_atleta', 'id_modalidade', 'papel', 'ordem', 'data_criacao', 'data_atualizacao', 'ativo'] },
  MODALIDADES: { name: 'tb_modalidades', headers: ['id_modalidade', 'nome_modalidade', 'placar_min', 'placar_max', 'permite_empate', 'formato', 'regras_pontos', 'ativo'] },
  INSCRICOES: { name: 'tb_inscricoes', headers: ['id_inscricao', 'id_torneio', 'id_equipe', 'id_modalidade', 'status', 'situacao_conclusao', 'data_inscricao', 'data_atualizacao', 'ativo'] },
  PARTIDAS: { name: 'tb_partidas', headers: ['id_partida', 'id_torneio', 'id_modalidade', 'rodada', 'chave', 'ordem', 'id_equipe_a', 'placar_a', 'id_equipe_b', 'placar_b', 'status_partida', 'pontos_desempate_a', 'pontos_desempate_b', 'tipo_desempate', 'data_criacao', 'data_atualizacao', 'ativo'] },
  CLASSIFICACOES: { name: 'tb_classificacoes_modalidade', headers: ['id_classificacao', 'id_torneio', 'id_modalidade', 'id_equipe', 'id_ctg', 'colocacao', 'pontos_tecnicos', 'vitorias', 'situacao_conclusao', 'status_homologacao', 'versao', 'observacao', 'data_homologacao', 'data_atualizacao', 'ativo'] },
  PONTUACAO_GERAL: { name: 'tb_pontuacao_geral', headers: ['id_registro', 'id_torneio', 'id_ctg', 'ctg', 'pontos_totais', 'primeiros_lugares', 'segundos_lugares', 'terceiros_lugares', 'status_desempate', 'observacao', 'ultima_atualizacao'] },
  AUDITORIA: { name: 'tb_auditoria', headers: ['id_auditoria', 'id_torneio', 'entidade', 'id_registro', 'acao', 'dados_anteriores', 'dados_novos', 'motivo', 'administrador', 'data_evento'] }
});

function initDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.values(DB_SCHEMAS).forEach(schema => ensureSheetSchema_(ss, schema));
  seedModalidades();
  const defaultSheet = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);
  seedTorneioPadrao_();
  PropertiesService.getScriptProperties().setProperty('SAE_DB_VERSION', '3');
  return { success: true, version: 3 };
}

function ensureSheetSchema_(ss, schema) {
  const sheet = ss.getSheetByName(schema.name) || ss.insertSheet(schema.name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, schema.headers.length).setValues([schema.headers]);
  const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].filter(String);
  const missing = schema.headers.filter(header => !current.includes(header));
  if (missing.length) sheet.getRange(1, current.length + 1, 1, missing.length).setValues([missing]);
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn());
  header.setBackground('#0f172a').setFontColor('#f8fafc').setFontWeight('bold').setFontFamily('Inter');
  sheet.setFrozenRows(1);
}

function seedModalidades() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DB_SCHEMAS.MODALIDADES.name);
  const existing = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues() : [];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const idIndex = headers.indexOf('id_modalidade');
  const rowsById = {};
  existing.forEach((row, index) => { rowsById[String(row[idIndex])] = index + 2; });
  MODALIDADES.forEach(modalidade => {
    const record = Object.assign({}, modalidade, { ativo: true });
    const values = headers.map(header => record[header] === undefined ? '' : record[header]);
    if (rowsById[modalidade.id_modalidade]) sheet.getRange(rowsById[modalidade.id_modalidade], 1, 1, values.length).setValues([values]);
    else sheet.appendRow(values);
  });
}

function generateUUID() { return Utilities.getUuid(); }
function getISODate() { return new Date().toISOString(); }

function seedTorneioPadrao_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(DB_SCHEMAS.TORNEIOS.name);
  if (sheet.getLastRow() > 1) return;
  const now = getISODate();
  dbInsertUnsafe_('tb_torneios', { id_torneio: generateUUID(), nome_torneio: 'Jogos Tradicionalistas 2025', ano: 2025, status: 'PLANEJAMENTO', data_inicio: '', data_fim: '', data_criacao: now, data_atualizacao: now, ativo: true });
}
