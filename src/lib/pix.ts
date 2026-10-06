/**
 * O código Pix "copia e cola" (BR Code estático, padrão do Banco Central).
 *
 * É um texto de campos encadeados, cada um no formato id + tamanho em dois
 * dígitos + conteúdo. O banco de quem paga lê isso; um caractere errado e o
 * aplicativo diz só "código inválido", sem dizer onde. Por isso tudo aqui é
 * conservador: sem acento, dentro do limite de cada campo, valor com ponto e
 * duas casas, e o CRC16 no fim conferindo o resto.
 *
 * Estava dentro de lib/assinatura.ts, servindo só à mensalidade do Bossa. Saiu
 * para cá porque agora cada estúdio também cobra os clientes dele por Pix.
 */

import { apenasDigitos } from "@/lib/formato";

export type TipoDeChave = "telefone" | "cpf" | "cnpj" | "email" | "aleatoria";

/**
 * Descobre o tipo da chave e devolve no formato que o BR Code espera.
 * Telefone vai com +55 na frente; CPF e CNPJ vão só com os dígitos; e-mail vai
 * em minúsculas; chave aleatória vai como está.
 */
export function normalizarChavePix(chave: string): { chave: string; tipo: TipoDeChave } | null {
  const limpa = chave.trim();
  if (!limpa) return null;

  if (limpa.includes("@")) {
    const email = limpa.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || email.length > 77) return null;
    return { chave: email, tipo: "email" };
  }

  // Chave aleatória: 32 dígitos hexadecimais, com ou sem os hífens.
  const semHifen = limpa.replace(/-/g, "");
  if (/^[0-9a-fA-F]{32}$/.test(semHifen)) {
    return { chave: semHifen.toLowerCase(), tipo: "aleatoria" };
  }

  const digitos = apenasDigitos(limpa);

  // Telefone já veio com o país.
  if (limpa.startsWith("+") && (digitos.length === 12 || digitos.length === 13)) {
    return { chave: `+${digitos}`, tipo: "telefone" };
  }
  // Telefone brasileiro sem o país. Mesma armadilha do DDD 55 de lib/telefone.ts:
  // a decisão é pelo tamanho, nunca pelo começo.
  if (digitos.length === 10 || digitos.length === 11) {
    return { chave: `+55${digitos}`, tipo: "telefone" };
  }
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith("55")) {
    return { chave: `+${digitos}`, tipo: "telefone" };
  }
  if (digitos.length === 11) return { chave: digitos, tipo: "cpf" };
  if (digitos.length === 14) return { chave: digitos, tipo: "cnpj" };

  return null;
}

/** Tira acento e tudo o que o BR Code não aceita, e deixa em maiúsculas. */
export function semAcento(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase()
    .trim();
}

function campo(id: string, valor: string) {
  return `${id}${String(valor.length).padStart(2, "0")}${valor}`;
}

export function crc16(texto: string) {
  let resultado = 0xffff;
  for (let i = 0; i < texto.length; i++) {
    resultado ^= texto.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      resultado =
        (resultado & 0x8000) !== 0
          ? ((resultado << 1) ^ 0x1021) & 0xffff
          : (resultado << 1) & 0xffff;
    }
  }
  return resultado.toString(16).toUpperCase().padStart(4, "0");
}

export type PedidoDePix = {
  chave: string;
  nome: string;
  cidade: string;
  valorCentavos: number;
  /** Aparece no extrato de quem paga. Só letras e números, até 25 caracteres. */
  identificador?: string;
};

export type ResultadoDoPix =
  | { certo: true; codigo: string }
  | { certo: false; motivo: string };

export function montarPix({
  chave,
  nome,
  cidade,
  valorCentavos,
  identificador = "***",
}: PedidoDePix): ResultadoDoPix {
  const normalizada = normalizarChavePix(chave);
  if (!normalizada) {
    return {
      certo: false,
      motivo:
        "Não reconheci essa chave Pix. Use o telefone com DDD, o CPF, o CNPJ, o e-mail ou a chave aleatória, exatamente como no seu banco.",
    };
  }

  if (!Number.isInteger(valorCentavos) || valorCentavos <= 0) {
    return { certo: false, motivo: "O valor da cobrança precisa ser maior que zero." };
  }
  // O campo do valor tem treze caracteres; acima disso o código sai quebrado.
  if (valorCentavos > 99_999_999_999) {
    return { certo: false, motivo: "Esse valor é alto demais para um código Pix." };
  }

  const nomeLimpo = semAcento(nome).slice(0, 25) || "ESTUDIO";
  const cidadeLimpa = semAcento(cidade).slice(0, 15) || "SAO PAULO";
  const idLimpo = semAcento(identificador).replace(/\s/g, "").slice(0, 25) || "***";

  const conta = campo("00", "br.gov.bcb.pix") + campo("01", normalizada.chave);

  const semCrc =
    campo("00", "01") +
    campo("26", conta) +
    campo("52", "0000") +
    campo("53", "986") +
    campo("54", (valorCentavos / 100).toFixed(2)) +
    campo("58", "BR") +
    campo("59", nomeLimpo) +
    campo("60", cidadeLimpa) +
    campo("62", campo("05", idLimpo)) +
    "6304";

  return { certo: true, codigo: semCrc + crc16(semCrc) };
}

/** Lê um código montado e devolve os campos, para os testes conferirem. */
export function lerCamposDoPix(codigo: string) {
  const campos: Record<string, string> = {};
  let posicao = 0;
  while (posicao + 4 <= codigo.length) {
    const id = codigo.slice(posicao, posicao + 2);
    const tamanho = Number(codigo.slice(posicao + 2, posicao + 4));
    if (!Number.isFinite(tamanho)) break;
    campos[id] = codigo.slice(posicao + 4, posicao + 4 + tamanho);
    posicao += 4 + tamanho;
  }
  return campos;
}
