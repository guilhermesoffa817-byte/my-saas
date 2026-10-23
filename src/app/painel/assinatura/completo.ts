import { recursoLigado, soNoCompleto, type Recurso } from "@/lib/recursos";

/**
 * Como cada recurso do Completo aparece na frase "O Completo libera ...", na
 * ordem da frase. O teste deste arquivo confere que todo recurso do Completo
 * tem a sua palavra aqui: um recurso novo sem texto quebra o teste.
 */
export const NA_FRASE_DO_COMPLETO: [Recurso, string][] = [
  ["lembretes", "lembretes de cobrança"],
  ["vencimentos", "contas a pagar"],
  ["documentos", "leitura de documentos"],
  ["custos", "custos"],
  ["relatorio", "relatório para o contador"],
  ["equipe", "equipe"],
  ["assistente", "o assistente"],
];

/** "a, b e c", como se fala. */
function emLista(itens: string[]) {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

/**
 * A frase da faixa "Essa parte é do plano Completo". Só cita o que está
 * ligado neste servidor: sem a chave da IA, documentos e assistente somem da
 * frase, como já somem da lista dos planos e do menu.
 */
export function oQueOCompletoLibera() {
  const itens = NA_FRASE_DO_COMPLETO.filter(
    ([recurso]) => soNoCompleto(recurso) && recursoLigado(recurso),
  ).map(([, texto]) => texto);
  return itens.length ? `O Completo libera ${emLista(itens)}.` : "";
}
