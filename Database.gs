
/**
 * MOTOR DE BANCO DE DADOS - PADRÃO SAE
 * Operações CRUD Genéricas com suporte a LockService (Anti-Concorrência)
 */

/**
 * Lê todos os registros de uma entidade e os converte em Array de Objetos JSON.
 */
function dbRead(entityName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(entityName);
  
  if (!sheet) throw new Error(`Entidade ${entityName} não encontrada no banco.`);
  
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Somente cabeçalho ou vazia
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    let item = {};
    headers.forEach((header, index) => {
      item[header] = row[index];
    });
    return item;
  });
}

/**
 * Insere um novo registro na entidade com Lock de Concorrência
 */
function dbInsert(entityName, recordObject) {
  const lock = LockService.getScriptLock();
  
  try {
    // Aguarda até 10 segundos para obter acesso exclusivo
    lock.waitLock(10000); 
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(entityName);
    
    const headers = DB_SCHEMAS[entityName.replace('tb_', '').toUpperCase()].headers;
    
    // Garante ID e Data de Criação se for o caso
    if (headers.includes('id_' + entityName.replace('tb_', '').slice(0, -1)) && !recordObject[headers[0]]) {
      recordObject[headers[0]] = generateUUID();
    }
    
    const newRow = headers.map(header => {
      return recordObject[header] !== undefined ? recordObject[header] : '';
    });
    
    sheet.appendRow(newRow);
    return { success: true, data: recordObject };
    
  } catch (error) {
    Logger.log(`Erro de Concorrência/Gravação: ${error.toString()}`);
    return { success: false, error: error.toString() };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Atualiza um registro existente com base no seu ID primário
 */
function dbUpdate(entityName, primaryKeyName, primaryKeyValue, updatedFields) {
  const lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(10000);
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(entityName);
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    const keyIndex = headers.indexOf(primaryKeyName);
    if (keyIndex === -1) throw new Error(`Chave primária ${primaryKeyName} não encontrada.`);
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][keyIndex] === primaryKeyValue) {
        
        // Atualiza apenas os campos passados
        headers.forEach((header, colIndex) => {
          if (updatedFields[header] !== undefined) {
            sheet.getRange(i + 1, colIndex + 1).setValue(updatedFields[header]);
          }
        });
        
        return { success: true };
      }
    }
    
    return { success: false, error: 'Registro não encontrado.' };
    
  } catch (error) {
    return { success: false, error: error.toString() };
  } finally {
    lock.releaseLock();
  }
}
