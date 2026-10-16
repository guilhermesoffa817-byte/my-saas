import "server-only";

import { createHmac } from "node:crypto";

/**
 * IP e telefone de quem tenta marcar viram um código que não volta atrás.
 *
 * A tabela de tentativas só precisa saber se "o mesmo IP" ou "o mesmo
 * telefone" tentou de novo, nunca qual era. O código usa o segredo do
 * servidor (SESSAO_SEGREDO), então quem abrir o banco não consegue testar
 * telefones um a um para descobrir quem tentou.
 */
export function embaralhar(tipo: "ip" | "telefone", valor: string) {
  const segredo = process.env.SESSAO_SEGREDO;
  if (!segredo || segredo.length < 16) {
    throw new Error("Defina SESSAO_SEGREDO no arquivo .env com pelo menos 16 caracteres.");
  }
  return createHmac("sha256", segredo).update(`${tipo}:${valor}`).digest("hex").slice(0, 40);
}
