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
  Utilities: { getUuid: () => `uuid-${++uuid}` },
  HtmlService: {}, ContentService: {}
});
['Modalidades.gs', 'SetupDB.gs', 'Database.gs', 'codigo.gs'].forEach(file => vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file }));
const run = expression => vm.runInContext(expression, context);

assert.equal(run('initDatabase().success'), true);
assert.equal(run('apiGetModalidades().data.length'), 6);
assert.deepEqual(JSON.parse(JSON.stringify(run("validarPlacarModalidade('bocha_48', 48, 30)"))), { placar_a: 48, placar_b: 30 });
assert.throws(() => run("validarPlacarModalidade('bocha_48', 49, 1)"), /0 a 48/);
assert.throws(() => run("validarPlacarModalidade('truco', 1, 1)"), /não permite/);

const first = run("apiCadastrarInscrito({nome:'Equipe A',ctg:'CTG Sul',id_modalidade:'bocha_campeira'})");
const second = run("apiCadastrarInscrito({nome:'Equipe B',ctg:'CTG Norte',id_modalidade:'bocha_campeira'})");
assert.equal(first.success && second.success, true);
assert.equal(run("apiCadastrarInscrito({nome:' Equipe A ',ctg:'ctg sul',id_modalidade:'bocha_campeira'}).success"), false);
assert.equal(run("apiCadastrarInscrito({nome:'Inválida',ctg:'CTG',id_modalidade:'x'}).success"), false);

const bracket = run("apiGerarChaves('bocha_campeira')");
assert.equal(bracket.success, true);
assert.equal(bracket.data.partidas_criadas, 1);
assert.equal(run("apiGerarChaves('bocha_campeira').success"), false);
const matchId = run("apiGetPartidasPorModalidade('bocha_campeira').data[0].id_partida");
assert.equal(run(`apiSalvarResultadoPartida({id_partida:'${matchId}',placar_a:12,placar_b:8}).success`), true);
assert.equal(run('apiGetClassificacaoGeral().data.length'), 2);
assert.equal(run(`apiExcluirInscrito('${first.data.id_equipe}').success`), false);

console.log('OK: regras, schemas, validação, integridade, chaveamento, placar e ranking.');
