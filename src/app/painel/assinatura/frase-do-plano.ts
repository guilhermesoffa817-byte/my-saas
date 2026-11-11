import { NOME_DA_FAMILIA, type FamiliaDoPlano } from "@/lib/assinatura";
import { planoMinimo, recursoLigado, type Recurso } from "@/lib/recursos";

/**
 * Como cada recurso dos planos Pro e VIP aparece na frase "O Pro libera ...",
 * na ordem da frase. O teste deste arquivo confere que todo recurso acima do
 * Normal tem a sua palavra aqui: um recurso novo sem texto quebra o teste.
 */
export const NA_FRASE_DO_PLANO: [Recurso, string][] = [
  ["documentos", "leitura de contrato e recibo"],
  ["vencimentos", "contas a pagar"],
  ["custos", "custos"],
  ["relatorio", "relatório para o contador"],
  ["lembretes", "lembretes de cobrança"],
  ["equipe", "equipe"],
  ["assistente", "o assistente"],
];

/** "a, b e c", como se fala. */
function emLista(itens: string[]) {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/**
 * A frase da faixa "Essa parte é do plano Pro/VIP". Só cita o que está ligado
 * neste servidor: sem a chave da IA, a leitura e o assistente somem da frase,
 * como já somem da lista dos planos e do menu. O VIP cita só o que é dele
 * (o resto já vem "do Pro").
 */
export function oQueOPlanoLibera(familia: FamiliaDoPlano) {
  if (familia === "normal") return "";
  const itens = NA_FRASE_DO_PLANO.filter(
    ([recurso]) => planoMinimo(recurso) === familia && recursoLigado(recurso),
  ).map(([, texto]) => texto);
  if (!itens.length) return "";
  const inicio = familia === "vip" ? `O ${NOME_DA_FAMILIA.vip} tem tudo do ${NOME_DA_FAMILIA.pro} e libera` : `O ${NOME_DA_FAMILIA.pro} libera`;
  return `${inicio} ${emLista(itens)}.`;
}
