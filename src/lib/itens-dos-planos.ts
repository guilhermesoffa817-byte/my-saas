import {
  LEITURAS_POR_MES_NO_COMPLETO,
  PERGUNTAS_POR_MES_NO_COMPLETO,
  type Recurso,
} from "@/lib/recursos";
import type { FamiliaDoPlano } from "@/lib/assinatura";

/**
 * O que cada plano tem, escrito para quem vai comprar.
 *
 * A página de vendas e a tela de assinatura leem esta lista, e só esta. Antes
 * cada uma tinha a sua, e as duas já tinham ficado para trás dos módulos novos.
 *
 * Cada linha diz de quais recursos (de recursos.ts) ela depende. O teste deste
 * arquivo confere que nenhuma linha do Simples promete recurso do Completo e
 * que todo recurso do Completo aparece na lista do Completo: mudar um recurso
 * de plano sem mudar o texto quebra o teste, em vez de virar promessa errada na
 * vitrine.
 */
export type ItemDoPlano = {
  texto: string;
  /** Vazio quando a linha não depende de nenhum recurso controlado por plano. */
  recursos: Recurso[];
};

export const ITENS_DO_SIMPLES: ItemDoPlano[] = [
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

/** O que o Completo acrescenta. A tela mostra "Tudo do Simples" antes. */
export const ITENS_DO_COMPLETO: ItemDoPlano[] = [
  {
    texto: "Lembrete de quem cobrar: antes, no dia e depois do vencimento",
    recursos: ["lembretes"],
  },
  {
    texto: "Contas a pagar e prazos de contrato, avisados antes de vencer",
    recursos: ["vencimentos"],
  },
  {
    texto: `Foto da conta ou do contrato lida pela IA, até ${LEITURAS_POR_MES_NO_COMPLETO} por mês, e você confere antes de salvar`,
    recursos: ["documentos"],
  },
  {
    texto: "Custos fixos e variáveis, e quanto faturar para empatar",
    recursos: ["custos"],
  },
  {
    texto: "Relatório do mês para o contador, em planilha e PDF, com fechamento e link de acesso",
    recursos: ["relatorio"],
  },
  {
    texto:
      "Equipe: quem trabalha com você, quem atende cada horário, ausências e pagamentos, que já entram como despesa",
    recursos: ["equipe"],
  },
  {
    texto: `Assistente que responde com os números do seu negócio, até ${PERGUNTAS_POR_MES_NO_COMPLETO} perguntas por mês`,
    recursos: ["assistente"],
  },
];

export const TUDO_DO_SIMPLES = "Tudo do Simples";

/** Os textos, prontos para a lista da tela. */
export function textosDoPlano(familia: FamiliaDoPlano) {
  return familia === "simples"
    ? ITENS_DO_SIMPLES.map((item) => item.texto)
    : [TUDO_DO_SIMPLES, ...ITENS_DO_COMPLETO.map((item) => item.texto)];
}
