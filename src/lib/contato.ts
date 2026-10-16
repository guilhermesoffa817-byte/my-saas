/**
 * Quem responde pelo Bossa, para as páginas de privacidade e de termos.
 *
 * Os valores vêm das variáveis de ambiente da Netlify, para o dono preencher
 * sem mexer no código. Enquanto não forem preenchidos, a página mostra o aviso
 * entre colchetes: melhor um "[PREENCHER]" à vista do que um nome inventado
 * numa página com valor legal.
 */

function ouAviso(valor: string | undefined, aviso: string) {
  const limpo = (valor ?? "").trim();
  return limpo || `[PREENCHER: ${aviso}]`;
}

export const RESPONSAVEL = {
  nome: ouAviso(process.env.RESPONSAVEL_NOME, "nome completo ou razão social"),
  documento: ouAviso(process.env.RESPONSAVEL_DOCUMENTO, "CPF ou CNPJ"),
  email: ouAviso(process.env.CONTATO_EMAIL, "e-mail de contato"),
  /** O encarregado de dados (LGPD, art. 41). Pode ser a mesma pessoa. */
  encarregado: ouAviso(process.env.ENCARREGADO_DE_DADOS, "nome do encarregado de dados"),
};

/** Só vira link de e-mail quando há um e-mail de verdade preenchido. */
export function emailDeContatoValido() {
  return /^[^\s@[\]]+@[^\s@]+\.[^\s@]+$/.test(RESPONSAVEL.email);
}
