const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class Range {
  constructor(sheet, row, col, rows, cols) { Object.assign(this, { sheet, row, col, rows, cols }); }
  getValues() { return Array.from({ length: this.rows }, (_, r) => Array.from({ length: this.cols }, (_, c) => this.sheet.cells[this.row - 1 + r]?.[this.col - 1 + c] ?? '')); }
  setValues(values) { values.forEach((line, r) => line.forEach((value, c) => { this.sheet.cells[this.row - 1 + r] ||= []; this.sheet.cells[this.row - 1 + r][this.col - 1 + c] = value; })); return this; }
  clearContent() { for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.sheet.cells[this.row - 1 + r]) this.sheet.cells[this.row - 1 + r][this.col - 1 + c] = ''; return this; }
  setBackground() { return this; } setFontColor() { return this; } setFontWeight() { return this; } setFontFamily() { return this; }
}
class Sheet {
  constructor(name) { this.name = name; this.cells = []; }
  getLastRow() { let last = 0; this.cells.forEach((row, i) => { if (row.some(value => value !== '')) last = i + 1; }); return last; }
  getLastColumn() { return Math.max(0, ...this.cells.map(row => row.length)); }
  getRange(row, col, rows = 1, cols = 1) { return new Range(this, row, col, rows, cols); }
  getDataRange() { return this.getRange(1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  appendRow(row) { this.cells.push(row.slice()); }
  setFrozenRows() {}
}
class Spreadsheet {
  constructor() { this.sheets = []; }
  getSheetByName(name) { return this.sheets.find(sheet => sheet.name === name) || null; }
  insertSheet(name) { const sheet = new Sheet(name); this.sheets.push(sheet); return sheet; }
  getSheets() { return this.sheets; }
  deleteSheet(sheet) { this.sheets = this.sheets.filter(item => item !== sheet); }
}

const spreadsheet = new Spreadsheet();
let uuid = 0;
const context = vm.createContext({
  console: { log: console.log, info: console.info, warn: console.warn, error() {} },
  SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  PropertiesService: { getScriptProperties: () => ({ setProperty() {} }) },
  Utilities: {
    getUuid: () => `uuid-${++uuid}`,
    base64Encode: bytes => Buffer.from(bytes).toString('base64'),
    formatDate: () => '31/07/2026',
    newBlob: (content, type, name) => ({
      getAs: () => ({ setName() { return this; }, getBytes: () => Buffer.from(content), getName: () => name })
    })
  },
  CacheService: { getScriptCache: () => ({ get: () => null, put() {} }) },
  UrlFetchApp: { fetch: () => { throw new Error('offline no teste'); } },
  MimeType: { PDF: 'application/pdf' },
  Session: { getActiveUser: () => ({ getEmail: () => 'admin@teste.local' }) },
  HtmlService: {
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
    createHtmlOutputFromFile: () => ({ setTitle() { return this; }, setXFrameOptionsMode() { return this; } })
  },
  ContentService: { MimeType: { JSON: 'JSON', JAVASCRIPT: 'JAVASCRIPT' }, createTextOutput: () => ({ setMimeType() { return this; } }) }
});
['Modalidades.gs', 'SetupDB.gs', 'Database.gs', 'Dominio2025.gs', 'codigo.gs', 'Sumulas.gs'].forEach(file => vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file }));
const run = expression => vm.runInContext(expression, context);
const indexHtml = fs.readFileSync('Index.html', 'utf8');
['Inscrições', 'Modalidades', 'Ranking por modalidade', 'Ranking geral', 'Administração'].forEach(label => assert.match(indexHtml, new RegExp(label)));
['modalidade-tava', 'modalidade-bocha_campeira', 'modalidade-tetarfe', 'modalidade-truco', 'modalidade-truco_cego', 'modalidade-bocha_48'].forEach(token => assert.match(indexHtml, new RegExp(token)));
assert.match(indexHtml, /Nova inscrição/);
assert.match(indexHtml, /Etapa \{\{modalStep\}\} de 4/);
assert.equal(run("getModalidadeRegra('truco').nome_modalidade"), 'Truco de Amostra');
assert.match(indexHtml, /toggle shrink-0/);
assert.match(indexHtml, /Titular/);
assert.match(indexHtml, /Reserva/);
assert.match(indexHtml, /Nome do Capataz/);
assert.match(indexHtml, /async function submit/);

assert.equal(run('initDatabase().success'), true);
assert.equal(run('initDatabase().version'), 6);
assert.doesNotThrow(() => run('doGet({parameter:{}})'));
assert.equal(run('apiGetModalidades().data.length'), 6);
assert.deepEqual(JSON.parse(JSON.stringify(run("validarPlacarModalidade('bocha_48', 48, 30)"))), { placar_a: 48, placar_b: 30 });
assert.throws(() => run("validarPlacarModalidade('bocha_48', 49, 1)"), /0 a 48/);
assert.throws(() => run("validarPlacarModalidade('truco', 1, 1)"), /não permite/);
assert.equal(run("calcularTavaEquipe_([{id_atleta:'1',jogadas:Array(10).fill('SORTE_CLAVADA')},{id_atleta:'2',jogadas:Array(10).fill('SORTE_CORRIDA')},{id_atleta:'3',jogadas:Array(10).fill('NEUTRO')},{id_atleta:'4',jogadas:Array(10).fill('CULO_CLAVADO')}]).total"), 30);
assert.equal(run("calcularTavaEquipe_([{id_atleta:'1',jogadas:Array(10).fill('SORTE_CLAVADA')},{id_atleta:'2',jogadas:Array(10).fill('SORTE_CORRIDA')},{id_atleta:'3',jogadas:Array(10).fill('NEUTRO')},{id_atleta:'4',jogadas:Array(10).fill('CULO_CLAVADO')}]).descartado.total"), -20);
assert.equal(run("validarDesempateBocha48_(48,48,[{pontos_a:5,pontos_b:5},{pontos_a:2,pontos_b:4}]).vencedor"), 'B');
assert.equal(run("calcularTetarfeEquipe_([{total:40},{total:30},{total:20}]).total"), 90);
assert.deepEqual(JSON.parse(JSON.stringify(run("validarQuedasTruco_([{pontos_a:12,pontos_b:5},{pontos_a:8,pontos_b:12},{pontos_a:12,pontos_b:9}])"))), { quedas_a: 2, quedas_b: 1, vencedor: 'A' });

const tournamentId = run("dbRead('tb_torneios')[0].id_torneio");
const cadastroFlexivel = run(`apiCadastrarInscricaoUnificada({id_requisicao:'req-flex-1',id_torneio:'${tournamentId}',nome_entidade:'Piquete Flexível',capataz:'Capataz Local',atletas:[{nome_atleta:'Competidor Único',modalidades:{bocha_campeira:true},papeis:{bocha_campeira:'TITULAR'}},{nome_atleta:''}]})`);
assert.equal(cadastroFlexivel.success, true, JSON.stringify(cadastroFlexivel));
assert.equal(cadastroFlexivel.data.atletas.length, 1);
assert.equal(cadastroFlexivel.data.equipes.length, 1);
assert.equal(run(`apiCadastrarInscricaoUnificada({id_requisicao:'req-flex-1',id_torneio:'${tournamentId}',nome_entidade:'Piquete Flexível',capataz:'Capataz Local',atletas:[{nome_atleta:'Competidor Único',modalidades:{bocha_campeira:true}}]}).success`), false);
assert.equal(run(`dbRead('tb_equipe_atletas').filter(i=>i.id_equipe==='${cadastroFlexivel.data.equipes[0].id_equipe}').length`), 1);

const entidadeA = run("apiSalvarEntidade({nome_entidade:'Piquete A',capataz:'Capataz A',celular:'51999990001',status_regularidade:'REGULAR'}).data");
const entidadeB = run("apiSalvarEntidade({nome_entidade:'Piquete B',capataz:'Capataz B',celular:'51999990002',status_regularidade:'REGULAR'}).data");
assert.equal(entidadeA.capataz, 'Capataz A');
const inscritoOperacional = run(`apiSalvarInscricaoOperacional({id_torneio:'${tournamentId}',id_entidade:'${entidadeA.id_entidade}',nome_atleta:'Atleta Toggle',telefone:'51988887777',modalidades:{tava:true,truco:true},papeis:{tava:'TITULAR',truco:'RESERVA'}})`);
assert.equal(inscritoOperacional.success, true);
assert.equal(run("apiGetInscricoesOperacionais().data.find(a=>a.nome_atleta==='Atleta Toggle').modalidades.tava"), true);
assert.equal(run("apiGetInscricoesOperacionais().data.find(a=>a.nome_atleta==='Atleta Toggle').papeis.truco"), 'RESERVA');
assert.equal(run(`apiInativarAtleta({id_torneio:'${tournamentId}',id_atleta:'${inscritoOperacional.data.id_atleta}',motivo:'Teste'}).success`), true);
assert.equal(run("String(apiGetInscricoesOperacionais().data.find(a=>a.nome_atleta==='Atleta Toggle').ativo).toLowerCase()"), 'false');
for (let i = 1; i <= 4; i++) {
  run(`apiSalvarInscricaoOperacional({id_torneio:'${tournamentId}',id_entidade:'${entidadeA.id_entidade}',nome_atleta:'Atleta A${i}',telefone:'5191111000${i}',modalidades:{bocha_campeira:true,tava:true},papeis:{bocha_campeira:'${i === 4 ? 'RESERVA' : 'TITULAR'}',tava:'TITULAR'}})`);
  if (i > 3) continue;
  run(`apiSalvarInscricaoOperacional({id_torneio:'${tournamentId}',id_entidade:'${entidadeB.id_entidade}',nome_atleta:'Atleta B${i}',telefone:'5192222000${i}',modalidades:{bocha_campeira:true}})`);
}
const teamA = run(`apiCadastrarEquipeRegulamentar({id_torneio:'${tournamentId}',id_entidade:'${entidadeA.id_entidade}',id_modalidade:'bocha_campeira',nome_equipe:'Trio A',ids_atletas:dbRead('tb_atletas').filter(a=>a.nome_atleta.startsWith('Atleta A')).map(a=>a.id_atleta)})`).data;
const teamB = run(`apiCadastrarEquipeRegulamentar({id_torneio:'${tournamentId}',id_entidade:'${entidadeB.id_entidade}',id_modalidade:'bocha_campeira',nome_equipe:'Trio B',ids_atletas:dbRead('tb_atletas').filter(a=>a.nome_atleta.startsWith('Atleta B')).map(a=>a.id_atleta)})`).data;
assert.equal(run(`dbRead('tb_equipe_atletas').find(i=>i.id_equipe==='${teamA.id_equipe}'&&i.papel==='RESERVA').papel`), 'RESERVA');
assert.equal(run("apiCadastrarInscrito({}).success"), false);
assert.equal(run(`apiSalvarAtleta({id_torneio:'${tournamentId}',id_entidade:'${entidadeB.id_entidade}',nome_atleta:'Atleta A1',telefone:'51911110001'}).success`), false);
assert.equal(run(`apiCadastrarEquipeRegulamentar({id_torneio:'${tournamentId}',id_entidade:'${entidadeA.id_entidade}',id_modalidade:'truco',nome_equipe:'Incompleta',ids_atletas:[dbRead('tb_atletas')[0].id_atleta]}).success`), false);
assert.equal(run('REGULAMENTO_2025.eficiencia[2]'), 8);
const tavaTeam = run(`apiCadastrarEquipeRegulamentar({id_torneio:'${tournamentId}',id_entidade:'${entidadeA.id_entidade}',id_modalidade:'tava',nome_equipe:'Tava A',ids_atletas:dbRead('tb_atletas').filter(a=>a.nome_atleta.startsWith('Atleta A')).map(a=>a.id_atleta)})`).data;
const tavaDisputa = run("apiGerarChaves('tava')");
assert.equal(tavaDisputa.data.formato, 'CLASSIFICACAO_DIRETA');
const tavaMatch = run("apiGetPartidasPorModalidade('tava').data[0]");
assert.equal(tavaMatch.id_equipe_b, '');
assert.equal(run(`apiSalvarResultadoPartida({id_partida:'${tavaMatch.id_partida}',placar_a:30,placar_b:0}).success`), true);

const bracket = run("apiGerarChaves('bocha_campeira')");
assert.equal(bracket.success, true, JSON.stringify(bracket));
assert.equal(bracket.data.partidas_criadas, 1);
assert.equal(run("apiGerarChaves('bocha_campeira').success"), false);
const matchId = run("apiGetPartidasPorModalidade('bocha_campeira').data[0].id_partida");
assert.equal(run(`apiGetPainelModalidade('bocha_campeira').data.equipes.find(e=>e.id_equipe==='${teamA.id_equipe}').atletas.length`), 4);
assert.equal(run(`apiGerarSumulaPdf('${matchId}').success`), false);
assert.equal(run(`apiSalvarResultadoPartida({id_partida:'${matchId}',placar_a:12,placar_b:8}).success`), true);
assert.equal(run('apiGetClassificacaoGeral().data.length'), 0);
const pdf = run(`apiGerarSumulaPdf('${matchId}')`);
assert.equal(pdf.success, true);
assert.match(pdf.data.fileName, /^SUMULA_BOCHA_CAMPEIRA_/);
assert.ok(pdf.data.base64.length > 100);
assert.match(run("renderDocumentoSumulas_([getPartidasSumula_().find(p=>p.id_modalidade==='bocha_campeira')], '')"), /BOCHA CAMPEIRA/);
assert.equal(run("['truco','truco_cego','tava','bocha_campeira','tetarfe','bocha_48'].every(id => { const p = Object.assign({}, getPartidasSumula_()[0], {id_modalidade:id}); return renderDocumentoSumulas_([p], '').includes('<article'); })"), true);
assert.equal((run("renderDocumentoSumulas_([1,2,3].map(n => Object.assign({}, getPartidasSumula_()[0], {id_modalidade:'truco',id_partida:String(n)})), '')").match(/<section class="page/g) || []).length, 2);
assert.equal(run(`apiExcluirInscrito(dbRead('tb_partidas').find(p=>p.id_partida==='${matchId}').id_equipe_a).success`), false);
assert.equal(run(`apiHomologarClassificacao({id_torneio:'${tournamentId}',id_modalidade:'bocha_campeira',classificacao:[{id_equipe:'${teamA.id_equipe}',colocacao:1,situacao_conclusao:'CONCLUIDA'},{id_equipe:'${teamB.id_equipe}',colocacao:2,situacao_conclusao:'CONCLUIDA'}]}).success`), true);
assert.deepEqual(Array.from(run('apiGetClassificacaoGeral().data.map(r=>Number(r.pontos_totais))')), [10, 8]);
assert.equal(run(`apiReabrirClassificacao({id_torneio:'${tournamentId}',id_modalidade:'bocha_campeira',motivo:'Correção auditada'}).success`), true);
assert.equal(run('apiGetClassificacaoGeral().data.length'), 0);

const reset = run("apiResetarBancoEvento({confirmacao:'RESETAR EVENTO',nome_torneio:'Evento Limpo'})");
assert.equal(reset.success, true);
assert.equal(run("dbRead('tb_atletas').length"), 0);
assert.equal(run("dbRead('tb_entidades').length"), 0);
assert.equal(run("dbRead('tb_torneios')[0].nome_torneio"), 'Evento Limpo');
console.log('OK: cadastro flexível, reset, domínio, chaveamento e súmulas PDF.');
