import type { Natureza } from "./calculo";

/**
 * Classificação por palavra-chave, em português, para as despesas do estúdio.
 *
 * Roda antes da IA: o que a regra resolve não gasta franquia e não sai do
 * servidor. Ela só olha o texto que a dona digitou (descrição e categoria), e
 * devolve junto o motivo, para a tela explicar por que classificou assim.
 */

type Regra = {
  natureza: Natureza;
  /** Casado contra o texto sem acento e em minúsculas (ou só sem acento, com `mantemCaixa`). */
  padrao: RegExp;
  mantemCaixa?: boolean;
  motivo: string;
};

/**
 * A ordem importa: "fora da operação" vem primeiro, porque "juros do cartão" ou
 * "parcela do financiamento da cadeira" não são custo variável nem fixo, mesmo
 * citando cartão ou equipamento. Depois os variáveis ("taxa da maquininha"
 * antes de qualquer "mensalidade" genérica) e, por fim, os fixos.
 */
const REGRAS: Regra[] = [
  // --- fora da operação ---
  { natureza: "nao_operacional", padrao: /\bjuros?\b/, motivo: "Juros são custo financeiro, não da operação." },
  { natureza: "nao_operacional", padrao: /\bmultas?\b/, motivo: "Multa não faz parte da operação." },
  { natureza: "nao_operacional", padrao: /\biof\b/, motivo: "IOF é custo financeiro, não da operação." },
  { natureza: "nao_operacional", padrao: /\bemprestimos?\b/, motivo: "Empréstimo é financiamento, não custo da operação." },
  { natureza: "nao_operacional", padrao: /\bfinanciamentos?\b/, motivo: "Financiamento não é custo da operação." },
  {
    natureza: "nao_operacional",
    padrao:
      /\b(compra|aquisicao) d[eoa]s? (equipamentos?|aparelhos?|maquinas?|moveis|cadeiras?|macas?|computador(es)?)\b/,
    motivo: "Compra de equipamento é investimento, não custo do mês.",
  },
  { natureza: "nao_operacional", padrao: /\binvestimentos?\b/, motivo: "Investimento não é custo do mês." },
  {
    natureza: "nao_operacional",
    padrao: /\bcarne[ -]?leao\b|\bimposto de renda\b|\birpf\b/,
    motivo: "Imposto de renda não é custo da operação; confirme com seu contador.",
  },

  // --- variáveis ---
  {
    natureza: "variavel",
    padrao: /\btaxas? (d[eoa]s? )?(cartao|maquin(inh)?a|credito|debito|antecipacao)\b|\bmaquininha\b/,
    motivo: "Taxa de cartão acompanha o que se recebe.",
  },
  {
    natureza: "variavel",
    // "DAS" só em maiúsculas: "das" minúsculo é a contração de "de + as".
    padrao: /\bDAS\b|\b[Ii][Ss][Ss]\b|\b[Ss]imples [Nn]acional\b/,
    mantemCaixa: true,
    motivo: "Imposto sobre o faturamento acompanha o que entra.",
  },
  { natureza: "variavel", padrao: /\bcomiss(ao|oes)\b/, motivo: "Comissão acompanha os atendimentos." },
  { natureza: "variavel", padrao: /\brepasses?\b/, motivo: "Repasse acompanha os atendimentos." },
  { natureza: "variavel", padrao: /\bcota[ -]parte\b/, motivo: "Cota-parte acompanha os atendimentos." },
  { natureza: "variavel", padrao: /\binsumos?\b/, motivo: "Insumo é gasto a cada atendimento." },
  { natureza: "variavel", padrao: /\bmateria(l|is)\b/, motivo: "Material é gasto a cada atendimento." },
  { natureza: "variavel", padrao: /\bdescartave(l|is)\b/, motivo: "Descartável é gasto a cada atendimento." },
  { natureza: "variavel", padrao: /\bprodutos?\b/, motivo: "Produto varia com o volume de atendimentos." },
  { natureza: "variavel", padrao: /\bfretes?\b/, motivo: "Frete varia com o volume de compras." },
  { natureza: "variavel", padrao: /\bembalage(m|ns)\b/, motivo: "Embalagem varia com o volume de vendas." },

  // --- fixos ---
  { natureza: "fixo", padrao: /\balugue(l|is)\b/, motivo: "Aluguel se paga todo mês, com ou sem atendimento." },
  { natureza: "fixo", padrao: /\bcondominio\b/, motivo: "Condomínio se paga todo mês." },
  { natureza: "fixo", padrao: /\binternet\b/, motivo: "Internet é conta mensal fixa." },
  { natureza: "fixo", padrao: /\b(energia|luz|eletricidade)\b/, motivo: "Conta de energia é custo fixo do espaço." },
  { natureza: "fixo", padrao: /\b(agua|saneamento)\b/, motivo: "Conta de água é custo fixo do espaço." },
  { natureza: "fixo", padrao: /\b(telefone|celular|telefonia)\b/, motivo: "Telefone é conta mensal fixa." },
  {
    natureza: "fixo",
    padrao: /\b(contador|contadora|contabilidade|contabil|honorarios contabeis)\b/,
    motivo: "Honorário do contador é mensal fixo.",
  },
  { natureza: "fixo", padrao: /\b(sistema|software|aplicativo)\b/, motivo: "Sistema é assinatura mensal fixa." },
  { natureza: "fixo", padrao: /\bassinaturas?\b/, motivo: "Assinatura se paga todo mês." },
  { natureza: "fixo", padrao: /\bseguros?\b/, motivo: "Seguro é custo fixo." },
  { natureza: "fixo", padrao: /\bsalarios?\b/, motivo: "Salário se paga todo mês, com ou sem atendimento." },
  { natureza: "fixo", padrao: /\banuidades?\b/, motivo: "Anuidade é custo fixo, mesmo paga de uma vez." },
  {
    natureza: "fixo",
    padrao: /\btarifas? (bancaria|da conta|de manutencao)\b|\bcesta de servicos\b/,
    motivo: "Tarifa mensal do banco é custo fixo.",
  },
  { natureza: "fixo", padrao: /\bmensalidades?\b/, motivo: "Mensalidade se paga todo mês." },
];

/** Sem acento, só letras e números, espaços simples. */
function semAcento(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim();
}

/** Minúsculas, sem acento, espaços simples. */
export function normalizar(texto: string) {
  return semAcento(texto).toLowerCase();
}

/**
 * O dinheiro que a dona tira para ela não é custo do estúdio: entra na conta
 * como retirada e fica fora da análise. Pró-labore conta aqui também, porque
 * num estúdio de uma pessoa só ele é exatamente isso.
 *
 * "Retirada" sozinha só vale quando é o texto inteiro: "retirada de lixo" é
 * serviço, não dinheiro da dona.
 */
const RETIRADA =
  /\bretiradas? (pessoa(l|is)|d[oa]s? (dono|dona|socios?|socias?|proprietari[oa]s?)|de lucros?|para (mim|casa|uso pessoal))\b|\bpro ?labore\b|\bprolabore\b|\bdistribuicao de lucros?\b/;

export function ehRetirada(despesa: { descricao: string; categoria: string | null }) {
  for (const texto of [despesa.descricao, despesa.categoria ?? ""]) {
    const limpo = normalizar(texto);
    if (!limpo) continue;
    if (limpo === "retirada" || limpo === "retiradas") return true;
    if (RETIRADA.test(limpo)) return true;
  }
  return false;
}

export type ResultadoDaRegra = { natureza: Natureza; motivo: string };

function regrasQueCasam(texto: string) {
  const comCaixa = semAcento(texto);
  if (!comCaixa) return [];
  const minusculo = comCaixa.toLowerCase();
  return REGRAS.filter((regra) => regra.padrao.test(regra.mantemCaixa ? comCaixa : minusculo));
}

/**
 * Tenta pela descrição primeiro (é mais específica) e depois pela categoria.
 * Devolve `null` quando nenhuma regra casa: aí é com a IA ou com a dona.
 *
 * A categoria só decide quando aponta para UMA natureza. "Impostos (DAS, ISS,
 * Carnê-Leão)" junta imposto sobre o faturamento (variável) com imposto de
 * renda (fora da operação): uma "Guia de setembro" nessa categoria fica sem
 * regra, em vez de virar Carnê-Leão só porque essa regra vem antes na lista.
 */
export function classificarPorRegra(entrada: {
  descricao: string;
  categoria?: string | null;
}): ResultadoDaRegra | null {
  const pelaDescricao = regrasQueCasam(entrada.descricao)[0];
  if (pelaDescricao) return { natureza: pelaDescricao.natureza, motivo: pelaDescricao.motivo };

  const pelaCategoria = regrasQueCasam(entrada.categoria ?? "");
  if (pelaCategoria.length === 0) return null;
  if (new Set(pelaCategoria.map((regra) => regra.natureza)).size > 1) return null;
  return { natureza: pelaCategoria[0].natureza, motivo: pelaCategoria[0].motivo };
}

/** O motivo cabe na coluna `naturezaMotivo` (até 200 caracteres). */
export function motivoParaGravar(motivo: string) {
  return motivo.trim().replace(/\s+/g, " ").slice(0, 200);
}

/**
 * A natureza com que um pagamento da Equipe já nasce. Comissão, cota-parte e
 * repasse sobem e descem com os atendimentos; salário e bolsa se pagam todo
 * mês. O resto (bônus, adiantamento, rescisão...) fica para a regra da
 * categoria ou para a dona, porque depende do caso.
 */
export function naturezaDoPagamentoDaEquipe(tipo: string): ResultadoDaRegra | null {
  if (tipo === "comissao" || tipo === "cota_parte" || tipo === "repasse") {
    return { natureza: "variavel", motivo: "Pagamento da Equipe que acompanha os atendimentos." };
  }
  if (tipo === "salario" || tipo === "bolsa") {
    return { natureza: "fixo", motivo: "Pagamento da Equipe que se repete todo mês." };
  }
  return null;
}
