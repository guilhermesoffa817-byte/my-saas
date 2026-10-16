import "server-only";

import Anthropic from "@anthropic-ai/sdk";

/**
 * O cliente da IA (Claude, da Anthropic), num lugar só, para os módulos que
 * conversam com ela: classificação de custos agora, o assistente depois.
 *
 * Só existe no servidor: a ANTHROPIC_API_KEY nunca chega ao navegador. A
 * leitura de documentos (lib/leitura.ts) ainda monta o cliente dela na rota,
 * mas usa o mesmo modelo e a mesma variável de ambiente.
 *
 * Tudo passa por `client.beta.messages.*`, porque `fallbacks` (a troca de
 * modelo do lado da Anthropic quando um pedido é recusado) só existe no método
 * beta do SDK.
 */

/** O modelo que o Bossa já usa na leitura de documentos. Troca-se pelo ambiente. */
export const MODELO_PADRAO = "claude-sonnet-5-5";

export function modeloDaIa() {
  return process.env.ANTHROPIC_MODELO?.trim() || MODELO_PADRAO;
}

/** Forma `fallbacks: "default"`. O header -06-01 é só da forma em lista e dá 400 aqui. */
export const BETA_FALLBACK = "server-side-fallback-2026-07-01" as const;

/**
 * Modelos que aceitam `fallbacks: "default"` na API da Anthropic. Se alguém
 * trocar o modelo pelo ambiente por um que não aceita, o pedido segue sem o
 * fallback em vez de voltar 400.
 */
const ACEITAM_FALLBACK_PADRAO = new Set([
  "claude-sonnet-5-5",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-fable-5-1",
]);

/** Os campos de fallback para espalhar no pedido, quando o modelo aceita. */
export function fallbackDoModelo(modelo: string): {
  betas?: (typeof BETA_FALLBACK)[];
  fallbacks?: "default";
} {
  return ACEITAM_FALLBACK_PADRAO.has(modelo) ? { betas: [BETA_FALLBACK], fallbacks: "default" } : {};
}

/** Lê o ambiente na hora da chamada, e não quando o arquivo carrega. */
export function iaConfigurada() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let cliente: Anthropic | null = null;

/** Um cliente por processo. O SDK lê a ANTHROPIC_API_KEY do ambiente. */
export function anthropic() {
  cliente ??= new Anthropic({ maxRetries: 2, timeout: 2 * 60_000 });
  return cliente;
}

export type ErroIA = { codigo: string; mensagem: string; repetivel: boolean };

/**
 * Erros do SDK em português, para a tela. A ordem importa: as subclasses vêm
 * antes de APIError, que é a mãe de quase todas.
 */
export function traduzirErroIA(erro: unknown): ErroIA {
  if (erro instanceof Anthropic.APIUserAbortError) {
    return { codigo: "cancelado", mensagem: "Pedido cancelado.", repetivel: false };
  }
  if (erro instanceof Anthropic.APIConnectionTimeoutError) {
    return {
      codigo: "tempo",
      mensagem: "A IA demorou demais para responder. Tente de novo.",
      repetivel: true,
    };
  }
  if (erro instanceof Anthropic.APIConnectionError) {
    return {
      codigo: "rede",
      mensagem: "Sem conexão com a IA agora. Tente de novo.",
      repetivel: true,
    };
  }
  if (erro instanceof Anthropic.RateLimitError) {
    return {
      codigo: "limite",
      mensagem: "Muitos pedidos agora. Espere um minuto e tente de novo.",
      repetivel: true,
    };
  }
  if (erro instanceof Anthropic.AuthenticationError || erro instanceof Anthropic.PermissionDeniedError) {
    return { codigo: "config", mensagem: "A IA não está configurada direito.", repetivel: false };
  }
  if (erro instanceof Anthropic.BadRequestError || erro instanceof Anthropic.NotFoundError) {
    return {
      codigo: "pedido",
      mensagem: "Não consegui montar o pedido para a IA.",
      repetivel: false,
    };
  }
  if (erro instanceof Anthropic.InternalServerError) {
    return {
      codigo: erro.type === "overloaded_error" ? "sobrecarga" : "servidor",
      mensagem: "A IA está instável. Tente de novo em instantes.",
      repetivel: true,
    };
  }
  // Erro que chega no meio de uma resposta em partes: APIError genérico, sem status.
  if (erro instanceof Anthropic.APIError) {
    const instavel =
      erro.type === "overloaded_error" || erro.type === "api_error" || erro.type === "timeout_error";
    return {
      codigo: erro.type ?? "api",
      mensagem: instavel ? "A IA está instável. Tente de novo em instantes." : "A IA respondeu com erro.",
      repetivel: instavel,
    };
  }
  if (erro instanceof Anthropic.AnthropicError) {
    return { codigo: "saida", mensagem: "A IA devolveu uma resposta incompleta.", repetivel: true };
  }
  return { codigo: "desconhecido", mensagem: "Erro inesperado.", repetivel: false };
}
