import {
  LEITURAS_POR_MES,
  PERGUNTAS_POR_MES,
  recursoLigado,
  type Recurso,
} from "@/lib/recursos";
import { NOME_DA_FAMILIA, type FamiliaDoPlano } from "@/lib/assinatura";

/**
 * O que cada plano tem, escrito para quem vai comprar.
 *
 * A página de vendas e a tela de assinatura leem esta lista, e só esta. Antes
 * cada uma tinha a sua, e as duas já tinham ficado para trás dos módulos novos.
 *
 * Cada linha diz de quais recursos (de recursos.ts) ela depende. O teste deste
 * arquivo confere que cada linha está no plano que libera o recurso dela, nem
 * antes nem depois: mudar um recurso de plano sem mudar o texto quebra o
 * teste, em vez de virar promessa errada na vitrine.
 */
export type ItemDoPlano = {
  texto: string;
  /** Vazio quando a linha não depende de nenhum recurso controlado por plano. */
  recursos: Recurso[];
};

export const ITENS_DO_NORMAL: ItemDoPlano[] = [
  { texto: "Agenda da semana, que avisa quando dois horários batem", recursos: [] },
  { texto: "Link para o cliente marcar sozinho, nos horários que você escolher", recursos: [] },
  { texto: "Clientes sem limite, cada um com a sua ficha", recursos: [] },
  { texto: "Serviços com preço e duração", recursos: [] },
  { texto: "Cobrança pelo WhatsApp com o código Pix pronto", recursos: ["cobrar"] },
  {
    texto: "Finanças: o que entrou, o que saiu, o resumo do mês e o imposto estimado",
    recursos: ["financas"],
  },
];

/** O que o Pro acrescenta. A tela mostra "Tudo do Normal" antes. */
export const ITENS_DO_PRO: ItemDoPlano[] = [
  {
    texto: `Foto do contrato, do recibo ou da conta lida pela IA, até ${LEITURAS_POR_MES} por mês, e você confere antes de salvar`,
    recursos: ["documentos"],
  },
  {
    texto: "Contas a pagar e prazos de contrato, avisados antes de vencer",
    recursos: ["vencimentos"],
  },
  {
    texto: "Custos fixos e variáveis, e quanto faturar para empatar",
    recursos: ["custos"],
  },
  {
    texto: "Relatório do mês para o contador, em planilha e PDF, com fechamento e link de acesso",
    recursos: ["relatorio"],
  },
];

/** O que o VIP acrescenta. A tela mostra "Tudo do Pro" antes. */
export const ITENS_DO_VIP: ItemDoPlano[] = [
  {
    texto:
      "Cobrança no piloto: todo dia o Bossa mostra quem cobrar (antes, no dia e depois do vencimento), com a mensagem e o Pix prontos para mandar",
    recursos: ["lembretes"],
  },
  {
    texto:
      "Equipe: quem trabalha com você, quem atende cada horário, ausências e pagamentos, que já entram como despesa",
    recursos: ["equipe"],
  },
  {
    texto: `Assistente que responde com os números do seu negócio, até ${PERGUNTAS_POR_MES} perguntas por mês`,
    recursos: ["assistente"],
  },
];

export const ITENS_POR_PLANO: Record<FamiliaDoPlano, ItemDoPlano[]> = {
  normal: ITENS_DO_NORMAL,
  pro: ITENS_DO_PRO,
  vip: ITENS_DO_VIP,
};

/** "Tudo do Normal" no Pro e "Tudo do Pro" no VIP. */
export function tudoDoAnterior(familia: FamiliaDoPlano) {
  if (familia === "pro") return `Tudo do ${NOME_DA_FAMILIA.normal}`;
  if (familia === "vip") return `Tudo do ${NOME_DA_FAMILIA.pro}`;
  return null;
}

/** Só as linhas cujos recursos estão ligados neste servidor: nada é vendido desligado. */
function ligados(itens: ItemDoPlano[]) {
  return itens.filter((item) => item.recursos.every(recursoLigado));
}

/** Os textos, prontos para a lista da tela. */
export function textosDoPlano(familia: FamiliaDoPlano) {
  const anterior = tudoDoAnterior(familia);
  const proprios = ligados(ITENS_POR_PLANO[familia]).map((item) => item.texto);
  return anterior ? [anterior, ...proprios] : proprios;
}
