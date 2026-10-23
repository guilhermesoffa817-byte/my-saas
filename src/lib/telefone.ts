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

/** Os DDDs que existem no Brasil (Anatel). Os que faltam, como 20, 23 e 50, não existem. */
const DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Confere se o número pode existir: DDD de verdade, celular com nove dígitos
 * começando em 9 ou fixo com oito começando de 2 a 8. Recusa também o número
 * de um algarismo só, como 99999-9999, que ninguém tem.
 *
 * Aceita quem escreveu o país na frente, pela mesma regra de tamanho de
 * `telefoneParaWhatsApp`: o que passa aqui vira link de WhatsApp sem erro.
 */
export function telefoneBrasileiroValido(telefone: string | null | undefined) {
  let digitos = apenasDigitos(telefone ?? "");
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    digitos = digitos.slice(2);
  }
  if (digitos.length !== 10 && digitos.length !== 11) return false;

  const ddd = Number(digitos.slice(0, 2));
  const numero = digitos.slice(2);
  if (!DDDS.has(ddd)) return false;
  if (/^(\d)\1+$/.test(numero)) return false;
  return numero.length === 9 ? numero.startsWith("9") : /^[2-8]/.test(numero);
}
