/**
 * Recuperação de senha.
 *
 * O Bossa não tem envio de e-mail, então o caminho clássico (link no e-mail)
 * não existe. O caminho que funciona hoje é o que o estúdio já usa para tudo:
 * a pessoa pede pela tela de entrada, o pedido aparece na administração, e quem
 * cuida do Bossa gera um link e manda pelo WhatsApp dela.
 *
 * Quando houver envio de e-mail, a mesma tabela e as mesmas funções servem: só
 * muda quem entrega o link.
 *
 * Regras que valem aqui:
 * - o código nunca é guardado, só o resumo dele. Quem abrir o banco não
 *   consegue entrar na conta de ninguém;
 * - vale meia hora e uma vez só;
 * - usar um código derruba todos os outros daquela conta, e derruba também as
 *   sessões abertas: se alguém entrou com a senha antiga, sai.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Meia hora é tempo de mandar pelo WhatsApp e a pessoa abrir, e pouco mais. */
export const MINUTOS_DE_VALIDADE = 30;

/** 32 bytes de aleatório: não há como adivinhar nem tentar por força bruta. */
export function gerarCodigo() {
  return randomBytes(32).toString("base64url");
}

/**
 * O resumo guardado no banco.
 *
 * SHA-256 e não bcrypt de propósito: bcrypt existe para proteger senha humana,
 * que é curta e previsível. Aqui o segredo tem 256 bits de aleatório, então
 * não há o que adivinhar, e o resumo rápido permite procurar direto pelo índice
 * em vez de ler a tabela inteira comparando linha a linha.
 */
export function resumoDoCodigo(codigo: string) {
  return createHash("sha256").update(codigo).digest("hex");
}

/** Comparação em tempo constante, para não vazar o código pelo tempo de resposta. */
export function codigoConfere(codigo: string, resumoGuardado: string) {
  const calculado = Buffer.from(resumoDoCodigo(codigo), "hex");
  let guardado: Buffer;
  try {
    guardado = Buffer.from(resumoGuardado, "hex");
  } catch {
    return false;
  }
  if (calculado.length !== guardado.length) return false;
  return timingSafeEqual(calculado, guardado);
}

export function validadeAPartirDe(agora = new Date()) {
  return new Date(agora.getTime() + MINUTOS_DE_VALIDADE * 60 * 1000);
}

export type Pedido = {
  expiraEm: Date;
  usadoEm: Date | null;
};

export function pedidoValido(pedido: Pedido | null | undefined, agora = new Date()) {
  if (!pedido) return false;
  if (pedido.usadoEm) return false;
  return pedido.expiraEm.getTime() > agora.getTime();
}

/** O endereço que a pessoa abre para escolher a senha nova. */
export function linkDaNovaSenha(enderecoDoSite: string, codigo: string) {
  return `${enderecoDoSite.replace(/\/+$/, "")}/nova-senha/${codigo}`;
}

/** A mensagem pronta para mandar pelo WhatsApp. */
export function mensagemDaNovaSenha({
  nome,
  link,
}: {
  nome: string;
  link: string;
}) {
  const primeiro = nome.trim().split(/\s+/)[0] ?? nome;
  return [
    `Oi, ${primeiro}! Aqui é do Bossa.`,
    "",
    "Este é o link para você escolher uma senha nova:",
    link,
    "",
    `Ele vale por ${MINUTOS_DE_VALIDADE} minutos e só funciona uma vez. Se não foi você quem pediu, pode ignorar.`,
  ].join("\n");
}
