/** Geração de súmulas oficiais em PDF usando somente serviços nativos do GAS. */
const SUMULA_CONFIG = Object.freeze({
  logoPageUrl: 'https://ibb.co/Y7fDQCY6',
  organizacao: 'CONFEDERAÇÃO BRASILEIRA DA TRADIÇÃO GAÚCHA - CBTG',
  evento: 'JOGOS TRADICIONALISTAS',
  ctg: 'CTG Rodeio dos Palmares',
  regiao: '6ª Região Tradicionalista',
  porPagina: Object.freeze({ truco: 2, truco_cego: 2, tava: 4, bocha_campeira: 2, tetarfe: 1, bocha_48: 2 })
});

function apiGerarSumulaPdf(idPartida) {
  return apiResponse_(() => {
    const partida = getPartidasSumula_().find(item => item.id_partida === String(idPartida || ''));
    if (!partida) throw new Error('Partida não encontrada.');
    validarPartidaFinalizada_(partida);
    return gerarPdfSumulas_([partida], `SUMULA_${slugArquivo_(partida.id_modalidade)}_${slugArquivo_(partida.chave || partida.id_partida)}.pdf`);
  });
}

function apiGerarSumulasModalidadePdf(idModalidade) {
  return apiResponse_(() => {
    if (!getModalidadeRegra(idModalidade)) throw new Error('Modalidade inválida.');
    const torneio = dbRead('tb_torneios').find(item => item.status !== 'ENCERRADO') || dbRead('tb_torneios')[0];
    const partidas = getPartidasSumula_().filter(item => (!torneio || item.id_torneio === torneio.id_torneio) && item.id_modalidade === idModalidade && item.status_partida === 'FINALIZADO');
    if (!partidas.length) throw new Error('Não há partidas finalizadas nesta modalidade.');
    return gerarPdfSumulas_(partidas, `SUMULAS_${slugArquivo_(idModalidade)}_${getISODate().slice(0, 10)}.pdf`);
  });
}

function getPartidasSumula_() {
  const equipes = {};
  dbRead('tb_equipes', true).forEach(item => { equipes[item.id_equipe] = item; });
  return dbRead('tb_partidas').map(partida => Object.assign({}, partida, {
    equipeA: equipes[partida.id_equipe_a] ? equipes[partida.id_equipe_a].nome_equipe : 'Equipe A',
    entidadeA: equipes[partida.id_equipe_a] ? equipes[partida.id_equipe_a].entidade_responsavel : '',
    equipeB: equipes[partida.id_equipe_b] ? equipes[partida.id_equipe_b].nome_equipe : (partida.id_equipe_b ? 'Equipe B' : ''),
    entidadeB: equipes[partida.id_equipe_b] ? equipes[partida.id_equipe_b].entidade_responsavel : ''
  }));
}

function validarPartidaFinalizada_(partida) {
  if (partida.status_partida !== 'FINALIZADO') throw new Error('A súmula somente pode ser gerada após a finalização da partida.');
  if (partida.placar_a === '' || partida.placar_b === '' || !Number.isFinite(Number(partida.placar_a)) || !Number.isFinite(Number(partida.placar_b))) {
    throw new Error('Finalize a partida com um placar válido antes de gerar a súmula.');
  }
}

function gerarPdfSumulas_(partidas, fileName) {
  partidas.forEach(validarPartidaFinalizada_);
  const html = renderDocumentoSumulas_(partidas, getLogoCbtgDataUrl_());
  const pdf = Utilities.newBlob(html, 'text/html', fileName.replace(/\.pdf$/i, '.html')).getAs(MimeType.PDF).setName(fileName);
  return { fileName, mimeType: 'application/pdf', base64: Utilities.base64Encode(pdf.getBytes()), total: partidas.length };
}

function renderDocumentoSumulas_(partidas, logoDataUrl) {
  if (!partidas.length) throw new Error('Nenhuma partida selecionada.');
  const modalidade = partidas[0].id_modalidade;
  const porPagina = SUMULA_CONFIG.porPagina[modalidade];
  if (!porPagina) throw new Error('Não existe template de súmula para esta modalidade.');
  const pages = [];
  for (let index = 0; index < partidas.length; index += porPagina) {
    pages.push(`<section class="page layout-${escapeHtml_(modalidade)}">${partidas.slice(index, index + porPagina).map(item => renderSumula_(item, logoDataUrl)).join('')}</section>`);
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>${getSumulaCss_()}</style></head><body>${pages.join('')}</body></html>`;
}

function renderSumula_(partida, logo) {
  const renderers = { truco: renderTruco_, truco_cego: renderTruco_, tava: renderTava_, bocha_campeira: renderBochaCampeira_, tetarfe: renderTetarfe_, bocha_48: renderBocha48_ };
  return renderers[partida.id_modalidade](partida, logo);
}

function cabecalhoSumula_(titulo, logo, compacto) {
  return `<header class="doc-head ${compacto ? 'compact' : ''}">${logo ? `<img src="${logo}" alt="CBTG">` : '<div class="logo-fallback">CBTG</div>'}<div><strong>${SUMULA_CONFIG.organizacao}</strong><span>DEPARTAMENTO DE ESPORTES</span><span>${SUMULA_CONFIG.evento}</span><b>${escapeHtml_(titulo)}</b></div></header>`;
}

function renderTruco_(p, logo) {
  const titulo = p.id_modalidade === 'truco_cego' ? 'SÚMULA DO JOGO DE TRUCO CEGO - MODALIDADE TRIO' : 'SÚMULA DO JOGO DE TRUCO DE AMOSTRA - MODALIDADE TRIO';
  const rows = [1, 2, 3].map((n, i) => `<tr><td>${i === 0 ? escapeHtml_(p.equipeA) : ''}</td><td>${i === 0 ? escapeHtml_(p.chave || '') : ''}</td><td>${i === 0 ? score_(p.placar_a) : ''}</td><th>${n}ª</th><td>${i === 0 ? score_(p.placar_b) : ''}</td><td>${i === 0 ? escapeHtml_(p.chave || '') : ''}</td><td>${i === 0 ? escapeHtml_(p.equipeB) : ''}</td></tr>`).join('');
  return `<article class="sumula truco">${cabecalhoSumula_(titulo, logo, true)}<div class="versus"><span>Entidade: ${escapeHtml_(p.entidadeA)}</span><b>X</b><span>Entidade: ${escapeHtml_(p.entidadeB)}</span></div><table><thead><tr><th>NOME DO TRIO</th><th>Nº DO TRIO</th><th>TENTOS</th><th>PARTIDAS</th><th>TENTOS</th><th>Nº DO TRIO</th><th>NOME DO TRIO</th></tr></thead><tbody>${rows}<tr><th colspan="3">SOMA: ${score_(p.placar_a)}</th><th>X</th><th colspan="3">SOMA: ${score_(p.placar_b)}</th></tr></tbody></table><p class="note">Obs.: melhor de três partidas, conforme regulamento da modalidade.</p>${resultadoDuplo_(p, 'TRIO')}<div class="local">Local e Data: ${dataPartida_(p)}</div>${assinaturas_(['Nome do Árbitro/Assinatura', 'Responsável p/Dep. de Truco', 'Diretor de Esportes da CBTG'])}</article>`;
}

function renderTava_(p, logo) {
  const cells = Array.from({ length: 10 }, (_, i) => `<th>${i + 1}</th>`).join('');
  const direto = !p.id_equipe_b; const nome = direto ? p.equipeA : `${p.equipeA} X ${p.equipeB}`; const total = direto ? score_(p.placar_a) : `${score_(p.placar_a)} x ${score_(p.placar_b)}`;
  const rows = Array.from({ length: 4 }, (_, i) => `<tr><th>${i + 1}</th><td class="athlete">${i === 0 ? escapeHtml_(nome) : ''}</td>${'<td></td>'.repeat(10)}<td>${i === 0 ? total : ''}</td></tr>`).join('');
  return `<article class="sumula tava">${cabecalhoSumula_('SÚMULA TAVA', logo, true)}<div class="mini-id"><b>Nº ${escapeHtml_(p.chave || '')}</b><b>Entidade: ${escapeHtml_(p.entidadeA)}${direto ? '' : ` x ${escapeHtml_(p.entidadeB)}`}</b></div><table><thead><tr><th colspan="2">ATLETAS</th><th colspan="10">ARREMESSOS / PONTOS</th><th>TOTAL</th></tr><tr><th></th><th>NOME</th>${cells}<th>PONTOS</th></tr></thead><tbody>${rows}<tr><th colspan="2">Anotações possíveis</th><th>2</th><th>1</th><th>0</th><th>-1</th><th>-2</th><th colspan="5">TOTAL GERAL</th><th>${total}</th></tr></tbody></table>${assinaturas_(['Árbitro', 'Capitão', 'Dir. Esporte'])}</article>`;
}

function renderBochaCampeira_(p, logo) {
  const points = Array.from({ length: 12 }, (_, i) => `<th>${i + 1}</th>`).join('');
  const athletes = Array.from({ length: 3 }, (_, i) => `<tr><td>${i === 0 ? escapeHtml_(p.equipeA) : ''}</td><td></td><td>${i === 0 ? escapeHtml_(p.equipeB) : ''}</td><td></td></tr>`).join('');
  return `<article class="sumula bocha">${cabecalhoSumula_('BOCHA CAMPEIRA — SÚMULA DO JOGO', logo, true)}<div class="fields"><b>FASE: ${escapeHtml_(p.rodada || '')}</b><b>CANCHA:</b><b>JOGO: ${escapeHtml_(p.chave || '')}</b></div><div class="versus"><span>ENTIDADE ${escapeHtml_(p.entidadeA)}</span><b>X</b><span>ENTIDADE ${escapeHtml_(p.entidadeB)}</span></div><table><thead><tr><th colspan="6">INÍCIO DO JOGO</th><th colspan="6">FINAL DO JOGO</th><th>PLACAR</th></tr><tr>${points}<th>${score_(p.placar_a)} X ${score_(p.placar_b)}</th></tr></thead></table><table><thead><tr><th>Nome Completo do Atleta</th><th>Assinatura</th><th>Nome Completo do Atleta</th><th>Assinatura</th></tr></thead><tbody>${athletes}<tr><th colspan="2">SUBSTITUIÇÃO — ENTROU / SAIU</th><th colspan="2">SUBSTITUIÇÃO — ENTROU / SAIU</th></tr></tbody></table><div class="local">Árbitro do Jogo: ____________________ Assinatura: ____________________</div><div class="observacoes">OBSERVAÇÕES DO ÁRBITRO</div><div class="local">Local: __________________ Data: ${dataPartida_(p)}</div>${assinaturas_(['Representante da Equipe', 'Mesário', 'Representante da Equipe'])}</article>`;
}

function renderTetarfe_(p, logo) {
  const bloco = (nome, idx) => `<div class="atleta"><b>Nome do Atleta ${idx}: ${escapeHtml_(nome)}</b><table><thead><tr><th>JOGOS</th><th colspan="10">ARREMESSOS / PONTOS</th><th>TOTAL</th></tr></thead><tbody><tr><td>TEJO (10 fichas)</td>${'<td></td>'.repeat(10)}<td></td></tr><tr><td>TAVA (4 arremessos)</td><td colspan="10"></td><td></td></tr><tr><td>ARGOLA (3 arremessos)</td><td colspan="10"></td><td></td></tr><tr><td>FERRADURA (3 arremessos)</td><td colspan="10"></td><td></td></tr><tr><th colspan="11">TOTAL GERAL</th><th></th></tr></tbody></table></div>`;
  return `<article class="sumula tetarfe">${cabecalhoSumula_('SÚMULA DO JOGO DE TETARFE (TEJO — TAVA — ARGOLA — FERRADURA)', logo, false)}<div class="fields"><b>ENTIDADES: ${escapeHtml_(p.entidadeA)} x ${escapeHtml_(p.entidadeB)}</b><b>Equipe: ${escapeHtml_(p.equipeA)} x ${escapeHtml_(p.equipeB)}</b></div>${[p.equipeA, '', p.equipeB, ''].map(bloco).join('')}<table><tr><th>TOTAL DE PONTOS CONQUISTADOS PELA EQUIPE</th><td>${score_(p.placar_a)} x ${score_(p.placar_b)}</td></tr></table><div class="rules">TEJO: 5,4,3,2,1,-1 · TAVA: 2,1,0,-1,-2 · ARGOLA: 5,3,1 · FERRADURA: 5,2</div><div class="local">Local/Data: ${dataPartida_(p)}</div>${assinaturas_(['Árbitro/Assinatura', 'Responsável p/Dep. de Tetarfe', 'Diretor de Esportes da CBTG'])}</article>`;
}

function renderBocha48_(p, logo) {
  const equipe = (nome, entidade, placar) => `<div class="team48"><div><b>ENTIDADE ${escapeHtml_(entidade)}</b><b>DUPLA ${escapeHtml_(nome)}</b></div><table><thead><tr><th rowspan="2">NOME DOS ATLETAS</th><th colspan="8">ARREMESSOS / PONTOS</th><th rowspan="2">TOTAL</th></tr><tr>${Array.from({ length: 8 }, (_, i) => `<th>${i + 1}</th>`).join('')}</tr></thead><tbody><tr><th>1</th>${'<td></td>'.repeat(8)}<td>${score_(placar)}</td></tr><tr><th>2</th>${'<td></td>'.repeat(8)}<td></td></tr><tr><td colspan="10">Valores: FRENTE 2 · ESQUERDA 4 · DIREITA 6 · ATRÁS 8 · BOLIM 12</td></tr></tbody></table></div>`;
  return `<article class="sumula bocha48">${cabecalhoSumula_(`${SUMULA_CONFIG.ctg} — ${SUMULA_CONFIG.regiao} — SÚMULA BOCHA 48`, logo, true)}<div class="fields"><b>FASE: ${escapeHtml_(p.rodada || '')}</b><b>JOGO Nº ${escapeHtml_(p.chave || '')}</b></div>${equipe(p.equipeA, p.entidadeA, p.placar_a)}<div class="contra">CONTRA</div>${equipe(p.equipeB, p.entidadeB, p.placar_b)}${resultadoDuplo_(p, 'DUPLA')}<div class="local">Data ${dataPartida_(p)}</div>${assinaturas_(['JUIZ', '', 'Diretor Esporte CTG'])}</article>`;
}

function resultadoDuplo_(p, label) {
  const a = Number(p.placar_a); const b = Number(p.placar_b); const aWins = a > b;
  return `<div class="result"><section><b>${label} VENCEDOR(A)</b><span>${escapeHtml_(aWins ? p.equipeA : p.equipeB)}</span><strong>TOTAL ${score_(aWins ? p.placar_a : p.placar_b)}</strong><i>Assinatura do Capataz</i></section><section><b>${label} PERDEDOR(A)</b><span>${escapeHtml_(aWins ? p.equipeB : p.equipeA)}</span><strong>TOTAL ${score_(aWins ? p.placar_b : p.placar_a)}</strong><i>Assinatura do Capataz</i></section></div>`;
}

function assinaturas_(labels) { return `<div class="signatures">${labels.map(label => `<span><i></i>${escapeHtml_(label)}</span>`).join('')}</div>`; }
function score_(value) { return value === '' || value === null || value === undefined ? '' : escapeHtml_(value); }
function dataPartida_(p) { const value = p.data_atualizacao || p.data_criacao || ''; return escapeHtml_(value instanceof Date ? Utilities.formatDate(value, 'America/Sao_Paulo', 'dd/MM/yyyy') : String(value).slice(0, 10).split('-').reverse().join('/')); }
function escapeHtml_(value) { return String(value === null || value === undefined ? '' : value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
function slugArquivo_(value) { return String(value || 'SEM_ID').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase(); }

function getLogoCbtgDataUrl_() {
  try {
    const cache = CacheService.getScriptCache();
    const cached = cache.get('SAE_LOGO_CBTG'); if (cached) return cached;
    const page = UrlFetchApp.fetch(SUMULA_CONFIG.logoPageUrl, { followRedirects: true, muteHttpExceptions: false }).getContentText();
    const match = page.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || page.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image/i);
    if (!match) return '';
    const imageUrl = match[1].replace(/&amp;/g, '&');
    const response = UrlFetchApp.fetch(imageUrl, { followRedirects: true, muteHttpExceptions: false });
    const blob = response.getBlob();
    const dataUrl = `data:${blob.getContentType()};base64,${Utilities.base64Encode(blob.getBytes())}`;
    if (dataUrl.length < 95000) cache.put('SAE_LOGO_CBTG', dataUrl, 21600);
    return dataUrl;
  } catch (error) { console.warn(`Logo CBTG indisponível: ${error.message}`); return ''; }
}

function getSumulaCss_() {
  return `@page{size:A4 portrait;margin:8mm}*{box-sizing:border-box}body{margin:0;color:#000;font-family:Arial,sans-serif;font-size:9px}.page{height:281mm;display:grid;gap:3mm;page-break-after:always}.page:last-child{page-break-after:auto}.layout-truco,.layout-truco_cego,.layout-bocha_campeira,.layout-bocha_48{grid-template-rows:repeat(2,1fr)}.layout-tava{grid-template-rows:repeat(4,1fr)}.layout-tetarfe{grid-template-rows:1fr}.sumula{border:1px solid #000;overflow:hidden}.doc-head{height:25mm;border-bottom:1px solid #000;display:flex;align-items:center;text-align:center;padding:2mm}.doc-head.compact{height:15mm}.doc-head img,.logo-fallback{width:15mm;height:15mm;object-fit:contain;display:flex;align-items:center;justify-content:center;font-weight:bold}.doc-head div:last-child{flex:1;display:flex;flex-direction:column;font-size:8px}.doc-head strong{font-size:11px}.doc-head b{font-size:10px}.versus,.fields,.mini-id{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:2mm;padding:1mm;border-bottom:1px solid #000}.versus b{text-align:center;font-size:16px}.mini-id{grid-template-columns:1fr 2fr}table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:1mm;text-align:center;height:5mm}.athlete{text-align:left}.note{font-size:7px;margin:1mm}.result{display:grid;grid-template-columns:1fr 1fr}.result section{border:1px solid #000;display:grid;text-align:center;min-height:18mm}.result i{border-top:1px dashed #000}.local,.observacoes,.rules{border:1px solid #000;padding:1.5mm;min-height:6mm}.observacoes{height:12mm;text-align:center}.signatures{display:grid;grid-template-columns:repeat(3,1fr);gap:8mm;padding:2mm}.signatures span{text-align:center}.signatures i{display:block;height:6mm;border-bottom:1px solid #000}.contra{text-align:center;background:#ddd;font-weight:bold;padding:1mm}.team48>div{display:flex;justify-content:space-between;padding:1mm}.atleta{margin-top:1mm}.tetarfe .atleta table td,.tetarfe .atleta table th{height:4mm;padding:.5mm}.tava th,.tava td{height:4mm;padding:.4mm}.tava .doc-head{display:none}.bocha th,.bocha td,.bocha48 th,.bocha48 td{height:4mm;padding:.5mm}`;
}
