/** Configuração e migração idempotente do banco Google Sheets. */
const DB_SCHEMAS = Object.freeze({
  EQUIPES: { name: 'tb_equipes', headers: ['id_equipe', 'nome_equipe', 'ctg_responsavel', 'contato', 'data_criacao', 'data_atualizacao', 'ativo'] },
  MODALIDADES: { name: 'tb_modalidades', headers: ['id_modalidade', 'nome_modalidade', 'placar_min', 'placar_max', 'permite_empate', 'formato', 'regras_pontos', 'ativo'] },
  INSCRICOES: { name: 'tb_inscricoes', headers: ['id_inscricao', 'id_equipe', 'id_modalidade', 'status', 'data_inscricao', 'data_atualizacao', 'ativo'] },
  PARTIDAS: { name: 'tb_partidas', headers: ['id_partida', 'id_modalidade', 'rodada', 'chave', 'ordem', 'id_equipe_a', 'placar_a', 'id_equipe_b', 'placar_b', 'status_partida', 'data_criacao', 'data_atualizacao', 'ativo'] },
  PONTUACAO_GERAL: { name: 'tb_pontuacao_geral', headers: ['id_registro', 'ctg', 'pontos_totais', 'vitorias_totais', 'ultima_atualizacao'] }
});

function initDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.values(DB_SCHEMAS).forEach(schema => ensureSheetSchema_(ss, schema));
  seedModalidades();
  const defaultSheet = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);
  PropertiesService.getScriptProperties().setProperty('SAE_DB_VERSION', '2');
  return { success: true, version: 2 };
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
