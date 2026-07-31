/** Persistência genérica para Google Sheets com operações internas transacionais. */
function getSchema_(entityName) {
  const schema = Object.values(DB_SCHEMAS).find(item => item.name === entityName);
  if (!schema) throw new Error(`Entidade ${entityName} não permitida.`);
  return schema;
}

function getSheet_(entityName) {
  getSchema_(entityName);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(entityName);
  if (!sheet) throw new Error(`Entidade ${entityName} não encontrada. Execute initDatabase().`);
  return sheet;
}

function dbRead(entityName, includeInactive) {
  const sheet = getSheet_(entityName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).filter(row => row.some(value => value !== '')).map(row => {
    const item = {};
    headers.forEach((header, index) => { if (header) item[header] = row[index]; });
    return item;
  }).filter(item => includeInactive || !Object.prototype.hasOwnProperty.call(item, 'ativo') || normalizeBoolean_(item.ativo));
}

function withDatabaseLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return callback(); } finally { lock.releaseLock(); }
}

function dbInsert(entityName, recordObject) {
  try { return withDatabaseLock_(() => dbInsertUnsafe_(entityName, recordObject)); }
  catch (error) { return { success: false, error: error.message || String(error) }; }
}

function dbInsertUnsafe_(entityName, recordObject) {
  const sheet = getSheet_(entityName);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(headers.map(header => recordObject[header] === undefined ? '' : recordObject[header]));
  return { success: true, data: recordObject };
}

function dbUpdate(entityName, primaryKeyName, primaryKeyValue, updatedFields) {
  try { return withDatabaseLock_(() => dbUpdateUnsafe_(entityName, primaryKeyName, primaryKeyValue, updatedFields)); }
  catch (error) { return { success: false, error: error.message || String(error) }; }
}

function dbUpdateUnsafe_(entityName, primaryKeyName, primaryKeyValue, updatedFields) {
  const sheet = getSheet_(entityName);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const keyIndex = headers.indexOf(primaryKeyName);
  if (keyIndex < 0) throw new Error(`Chave primária ${primaryKeyName} não encontrada.`);
  const rowIndex = data.findIndex((row, index) => index > 0 && String(row[keyIndex]) === String(primaryKeyValue));
  if (rowIndex < 0) return { success: false, error: 'Registro não encontrado.' };
  const row = data[rowIndex].slice();
  headers.forEach((header, col) => { if (updatedFields[header] !== undefined) row[col] = updatedFields[header]; });
  sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([row]);
  return { success: true };
}

function normalizeBoolean_(value) { return value === true || String(value).toLowerCase() === 'true' || value === 1; }
