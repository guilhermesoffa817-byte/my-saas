/**
 * Aniversário de cliente: quem faz anos nos próximos dias.
 *
 * Só o dia e o mês contam. O dia é lido no fuso do estúdio, do mesmo jeito que
 * a ficha mostra a data: o nascimento é guardado como meia-noite em São Paulo,
 * e uma conta feita em outro fuso poderia jogar o aniversário para a véspera.
 *
 * Quem nasceu em 29 de fevereiro comemora no dia 28 nos anos que não são
 * bissextos. Assim o aniversário não some do ano e continua em fevereiro.
 *
 * Os dias calculados aqui são datas puras (meia-noite em UTC), como o
 * `hojeNoEstudio`, para que a diferença em dias nunca escorregue por fuso.
 */

import {
  deDataPura,
  diferencaEmDias,
  paraDataLocal,
  paraDataPura,
  primeiroNome,
  ultimoDiaDoMes,
} from "@/lib/formato";

/** O dia e o mês do nascimento, no fuso do estúdio. */
export function diaEMesDoNascimento(nascimento: Date) {
  const [, mes, dia] = paraDataLocal(nascimento).split("-").map(Number);
  return { mes, dia };
}

function doisDigitos(numero: number) {
  return String(numero).padStart(2, "0");
}

/** O aniversário caindo naquele ano, já com o 29 de fevereiro resolvido. */
function aniversarioNoAno(ano: number, mes: number, dia: number) {
  const diaQueExiste = Math.min(dia, ultimoDiaDoMes(ano, mes));
  return deDataPura(`${ano}-${doisDigitos(mes)}-${doisDigitos(diaQueExiste)}`)!;
}

/**
 * O próximo aniversário a partir de hoje, e quantos dias faltam. Zero é hoje.
 * Quando o deste ano já passou, vale o do ano que vem: é o que faz dezembro
 * enxergar quem faz anos no começo de janeiro.
 */
export function proximoAniversario(nascimento: Date, hoje: Date) {
  const { mes, dia } = diaEMesDoNascimento(nascimento);
  const ano = hoje.getUTCFullYear();

  const desteAno = aniversarioNoAno(ano, mes, dia);
  const faltam = diferencaEmDias(hoje, desteAno);
  if (faltam >= 0) return { data: desteAno, emDias: faltam };

  const doAnoQueVem = aniversarioNoAno(ano + 1, mes, dia);
  return { data: doAnoQueVem, emDias: diferencaEmDias(hoje, doAnoQueVem) };
}

/**
 * Quem faz aniversário de hoje até os próximos dias (uma semana, contando
 * hoje). Em ordem de data e, no mesmo dia, de nome.
 */
export function aniversariantes<T extends { nome: string; nascimento: Date | null }>(
  clientes: T[],
  hoje: Date,
  dias = 7,
) {
  const lista: (T & { data: Date; emDias: number })[] = [];

  for (const cliente of clientes) {
    if (!cliente.nascimento) continue;
    const proximo = proximoAniversario(cliente.nascimento, hoje);
    if (proximo.emDias < dias) lista.push({ ...cliente, ...proximo });
  }

  return lista.sort(
    (a, b) => a.emDias - b.emDias || a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

/** "Hoje", "Amanhã" ou "Sábado, 17/10". */
export function quandoFazAniversario(emDias: number, data: Date) {
  if (emDias === 0) return "Hoje";
  if (emDias === 1) return "Amanhã";

  // Data pura: o dia da semana sai em UTC, que é onde ela mora.
  const semana = data.toLocaleDateString("pt-BR", { timeZone: "UTC", weekday: "long" });
  const [, mes, dia] = paraDataPura(data).split("-");
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)}, ${dia}/${mes}`;
}

/**
 * A mensagem de parabéns. No dia, é o parabéns de verdade. Antes dele, é um
 * parabéns adiantado, para quem prefere mandar com antecedência.
 */
export function mensagemDeParabens({
  nomeDoCliente,
  nomeDoEstudio,
  emDias,
}: {
  nomeDoCliente: string;
  nomeDoEstudio: string;
  emDias: number;
}) {
  const nome = primeiroNome(nomeDoCliente);
  const desejo = "Que o seu novo ano venha leve e cheio de coisas boas.";

  if (emDias === 0) {
    return `Oi, ${nome}! Aqui é do ${nomeDoEstudio}. Hoje é o seu dia: feliz aniversário! ${desejo} Um abraço!`;
  }
  return `Oi, ${nome}! Aqui é do ${nomeDoEstudio}. Vi que o seu aniversário está chegando e já quero deixar os parabéns adiantados. ${desejo} Um abraço!`;
}
