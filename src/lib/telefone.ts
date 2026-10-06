/**
 * Telefone para o link do WhatsApp.
 *
 * O WhatsApp só aceita o número com o código do país na frente, sem sinal de
 * mais e sem pontuação. O erro clássico aqui é decidir pelo começo: "se começa
 * com 55, já tem país". Não dá, porque 55 também é o DDD de Caxias do Sul e de
 * toda a serra gaúcha. (55) 99999-8888 tem onze dígitos e começa com 55, e
 * mesmo assim precisa ganhar o país na frente.
 *
 * Por isso a decisão é pelo tamanho, não pelo começo:
 *   10 ou 11 dígitos  -> é número brasileiro sem país, acrescenta 55
 *   12 ou 13 dígitos começando com 55 -> já tem país, mantém
 *   qualquer outro    -> não sei o que é, peço para a pessoa corrigir
 */

import { apenasDigitos } from "@/lib/formato";

export type Telefone =
  | { certo: true; paraWhatsApp: string }
  | { certo: false; motivo: string };

export function telefoneParaWhatsApp(telefone: string | null | undefined): Telefone {
  const digitos = apenasDigitos(telefone ?? "");

  if (digitos.length === 0) {
    return { certo: false, motivo: "Esse cliente está sem telefone na ficha." };
  }

  if (digitos.length === 10 || digitos.length === 11) {
    return { certo: true, paraWhatsApp: `55${digitos}` };
  }

  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    return { certo: true, paraWhatsApp: digitos };
  }

  return {
    certo: false,
    motivo:
      "O telefone da ficha não está no formato certo. Precisa ter DDD e número, como (66) 99251-3501.",
  };
}

/** O endereço que abre a conversa do cliente no WhatsApp com o texto pronto. */
export function linkDoWhatsApp(numeroComPais: string, mensagem: string) {
  return `https://wa.me/${numeroComPais}?text=${encodeURIComponent(mensagem)}`;
}
