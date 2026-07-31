/**
 * SISTEMA ERP CAMPEIRO - PADRÃO SAE
 * Módulo: Setup e Estruturação do Banco de Dados (Google Sheets)
 */

// IDs Globais e Nomes de Abas (Entidades)
const DB_SCHEMAS = {
  EQUIPES: {
    name: 'tb_equipes',
    headers: ['id_equipe', 'nome_equipe', 'ctg_responsavel', 'contato', 'data_criacao', 'ativo']
  },
  MODALIDADES: {
    name: 'tb_modalidades',
    headers: ['id_modalidade', 'nome_modalidade', 'regras_pontos', 'ativo']
  },
  INSCRICOES: {
    name: 'tb_inscricoes',
    headers: ['id_inscricao', 'id_equipe', 'id_modalidade', 'status', 'data_inscricao']
  },
  PARTIDAS: {
    name: 'tb_partidas',
    headers: ['id_partida', 'id_modalidade', 'rodada', 'chave', 'id_equipe_a', 'placar_a', 'id_equipe_b', 'placar_b', 'status_partida', 'data_atualizacao']
  },
  PONTUACAO_GERAL: {
    name: 'tb_pontuacao_geral',
    headers: ['id_registro', 'ctg', 'pontos_totais', 'vitorias_totais', 'ultima_atualizacao']
  }
};

/**
 * Função Principal para Inicializar todo o Banco de Dados.
 * Execute esta função uma vez no editor do Apps Script.
 */
function initDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  Object.values(DB_SCHEMAS).forEach(schema => {
    let sheet = ss.getSheetByName(schema.name);
    
    // Cria a aba se não existir
    if (!sheet) {
      sheet = ss.insertSheet(schema.name);
    }
    
    // Configura os Cabeçalhos se estiver vazia
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(schema.headers);
      
      // Estilização Padrão SAE para o Banco (Header Dark / Frosted Grid)
      const headerRange = sheet.getRange(1, 1, 1, schema.headers.length);
      headerRange.setBackground('#0f172a')
                 .setFontColor('#f8fafc')
                 .setFontWeight('bold')
                 .setFontFamily('Inter');
      
      sheet.setFrozenRows(1);
    }
  });

  // Apaga a "Aba1" ou "Sheet1" padrão criada pelo Google, se existir
  const defaultSheet = ss.getSheetByName('Página1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) {
    ss.deleteSheet(defaultSheet);
  }

  // Carga dos Dados Iniciais de Domínio
  seedModalidades();
  
  Logger.log('✅ Banco de Dados SAE inicializado e configurado com sucesso!');
}

/**
 * Insere as 6 modalidades padrão de torneios campeiros
 */
function seedModalidades() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(DB_SCHEMAS.MODALIDADES.name);
  
  if (sheet.getLastRow() > 1) return; // Evita duplicar se já houver dados

  const modalidadesPadrão = [
    [generateUUID(), 'Tava', 'Pontuação por arremesso', true],
    [generateUUID(), 'Bocha Campeira', 'Pontuação por aproximação', true],
    [generateUUID(), 'Tetarfe', 'Pontuação cumulativa', true],
    [generateUUID(), 'Truco', 'Melhor de 3 rodadas', true],
    [generateUUID(), 'Truco Cego', 'Melhor de 3 rodadas sem visibilidade', true],
    [generateUUID(), 'Bocha 48', 'Macho / Ponto fixo 48', true]
  ];

  sheet.getRange(2, 1, modalidadesPadrão.length, DB_SCHEMAS.MODALIDADES.headers.length).setValues(modalidadesPadrão);
}

/**
 * Helper: Gerador de UUID v4 para Chaves Primárias
 */
function generateUUID() {
  return 'axxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Helper: Normalizador de Datas para ISO 8601 UTC
 */
function getISODate() {
  return new Date().toISOString();
}
