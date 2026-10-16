import {
  LEITURAS_POR_MES_NO_VIP,
  PERGUNTAS_POR_MES_NO_VIP,
  type Recurso,
} from "@/lib/recursos";

/**
 * O que cada plano tem, escrito para quem vai comprar.
 *
 * A página de vendas e a tela de assinatura leem esta lista, e só esta. Antes
 * cada uma tinha a sua, e as duas já tinham ficado para trás dos módulos novos.
 *
 * Cada linha diz de quais recursos (de recursos.ts) ela depende. O teste deste
 * arquivo confere que nenhuma linha do Essencial promete recurso do VIP e que
 * todo recurso do VIP aparece na lista do VIP: mudar um recurso de plano sem
 * mudar o texto quebra o teste, em vez de virar promessa errada na vitrine.
 */
export type ItemDoPlano = {
  texto: string;
  /** Vazio quando a linha não depende de nenhum recurso controlado por plano. */
  recursos: Recurso[];
};

export const ITENS_DO_ESSENCIAL: ItemDoPlano[] = [
  { texto: "Agenda da semana, que avisa quando dois horários batem", recursos: [] },
  { texto: "Link para o cliente marcar sozinho, nos horários que você escolher", recursos: [] },
  { texto: "Clientes sem limite, cada um com a sua ficha", recursos: [] },
  { texto: "Cobrança pelo WhatsApp com o código Pix pronto", recursos: ["cobrar"] },
  { texto: "Faturamento do mês somado sozinho", recursos: [] },
];

/** O que o VIP acrescenta. A tela mostra "Tudo do Essencial" antes. */
export const ITENS_DO_VIP: ItemDoPlano[] = [
  {
    texto: "Lembrete de quem cobrar: antes, no dia e depois do vencimento",
    recursos: ["lembretes"],
  },
  {
    texto: "Contas a pagar e prazos de contrato, avisados antes de vencer",
    recursos: ["vencimentos"],
  },
  {
    texto: `Foto da conta ou do contrato lida pela IA, até ${LEITURAS_POR_MES_NO_VIP} por mês, e você confere antes de salvar`,
    recursos: ["documentos"],
  },
  {
    texto: "Finanças: o que entrou, o que saiu, o que sobrou e o imposto estimado",
    recursos: ["financas"],
  },
  {
    texto: "Custos fixos e variáveis, e quanto faturar para empatar",
    recursos: ["custos"],
  },
  {
    texto: "Relatório do mês para o contador, em planilha e PDF, com link de acesso",
    recursos: ["financas"],
  },
  {
    texto: "Equipe: quem trabalha com você, ausências e pagamentos, que já entram como despesa",
    recursos: ["equipe"],
  },
  {
    texto: `Assistente que responde com os números do seu negócio, até ${PERGUNTAS_POR_MES_NO_VIP} perguntas por mês`,
    recursos: ["assistente"],
  },
];

export const TUDO_DO_ESSENCIAL = "Tudo do Essencial";

/** Os textos, prontos para a lista da tela. */
export function textosDoPlano(familia: "essencial" | "vip") {
  return familia === "essencial"
    ? ITENS_DO_ESSENCIAL.map((item) => item.texto)
    : [TUDO_DO_ESSENCIAL, ...ITENS_DO_VIP.map((item) => item.texto)];
}
