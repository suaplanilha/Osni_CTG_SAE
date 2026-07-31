/**
 * Regras oficiais do domínio. Esta é a única fonte de verdade das modalidades.
 * Os IDs são estáveis para preservar relacionamentos entre implantações.
 */
const MODALIDADES = Object.freeze([
  { id_modalidade: 'tava', nome_modalidade: 'Tava', placar_min: -60, placar_max: 60, permite_empate: false, formato: 'PONTOS_INDIVIDUAIS', regras_pontos: 'Soma dos três melhores atletas; desempate técnico e séries extras sucessivas.' },
  { id_modalidade: 'bocha_campeira', nome_modalidade: 'Bocha Campeira', placar_min: 0, placar_max: 12, permite_empate: false, formato: 'ELIMINATORIA', regras_pontos: 'Partida até 12 pontos; empate não encerra o confronto.' },
  { id_modalidade: 'tetarfe', nome_modalidade: 'Tetarfe', placar_min: -72, placar_max: 324, permite_empate: false, formato: 'PONTOS_INDIVIDUAIS', regras_pontos: 'Soma de 1 a 4 atletas; desempate por desempenhos individuais e série extra.' },
  { id_modalidade: 'truco', nome_modalidade: 'Truco', placar_min: 0, placar_max: 2, permite_empate: false, formato: 'MELHOR_DE_3', regras_pontos: 'Melhor de três quedas; primeiro a duas vitórias.' },
  { id_modalidade: 'truco_cego', nome_modalidade: 'Truco Cego', placar_min: 0, placar_max: 2, permite_empate: false, formato: 'MELHOR_DE_3', regras_pontos: 'Melhor de três quedas sem visualização; primeiro a duas vitórias.' },
  { id_modalidade: 'bocha_48', nome_modalidade: 'Bocha 48', placar_min: 0, placar_max: 48, permite_empate: false, formato: 'PONTOS_COM_DESEMPATE', regras_pontos: 'Teto de 48; empate regulamentar exige Carambola e tiros de ouro sucessivos.' }
]);

function getModalidadeRegra(idModalidade) {
  return MODALIDADES.find(item => item.id_modalidade === String(idModalidade || '').trim()) || null;
}

function validarPlacarModalidade(idModalidade, placarA, placarB) {
  const regra = getModalidadeRegra(idModalidade);
  if (!regra) throw new Error('Modalidade inválida.');
  const a = Number(placarA);
  const b = Number(placarB);
  if (!Number.isInteger(a) || !Number.isInteger(b)) throw new Error('Os placares devem ser números inteiros.');
  if (a < regra.placar_min || b < regra.placar_min || a > regra.placar_max || b > regra.placar_max) {
    throw new Error(`Placar permitido para ${regra.nome_modalidade}: ${regra.placar_min} a ${regra.placar_max}.`);
  }
  if (!regra.permite_empate && a === b) throw new Error(`${regra.nome_modalidade} não permite resultado final empatado.`);
  return { placar_a: a, placar_b: b };
}
