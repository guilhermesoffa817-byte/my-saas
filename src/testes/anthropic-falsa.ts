import Anthropic from "@anthropic-ai/sdk";

/**
 * Uma API da Anthropic de mentira para os testes: o SDK de verdade, com um
 * `fetch` que nunca sai da máquina. Assim o teste confere os bytes que iriam
 * para a API e o caminho de volta pelo SDK, sem chave e sem gastar nada.
 *
 * O SDK guarda o `fetch` quando o cliente nasce; por isso as respostas vêm de
 * uma função que olha o pedido, e não de uma troca do `fetch` global.
 */

export const usoFalso = {
  input_tokens: 100,
  output_tokens: 20,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
  server_tool_use: null,
  service_tier: "standard",
};

/** Uma resposta comum da API, com um bloco de texto. */
export function mensagem(texto: string | null, stopReason = "end_turn") {
  return {
    id: "msg_teste",
    type: "message",
    role: "assistant",
    model: "claude-sonnet-5-5",
    content: texto === null ? [] : [{ type: "text", text: texto }],
    stop_reason: stopReason,
    stop_details:
      stopReason === "refusal"
        ? { type: "refusal", category: null, explanation: null, recommended_model: null }
        : null,
    stop_sequence: null,
    usage: usoFalso,
  };
}

export function emJson(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function erroDaApi(status: number, tipo: string) {
  return emJson({ type: "error", error: { type: tipo, message: "erro de teste" } }, status);
}

export type PedidoRecebido = {
  url: string;
  cabecalhos: Headers;
  corpo: Record<string, unknown>;
};

/** Cliente cujo `fetch` responde com `responder(pedido)` e guarda cada pedido. */
export function apiFalsa(responder: (pedido: PedidoRecebido) => Response | Promise<Response>) {
  const pedidos: PedidoRecebido[] = [];
  const cliente = new Anthropic({
    apiKey: "sk-teste",
    maxRetries: 0,
    fetch: async (url, init) => {
      const pedido = {
        url: String(url),
        cabecalhos: new Headers(init?.headers),
        corpo: JSON.parse(String(init?.body)) as Record<string, unknown>,
      };
      pedidos.push(pedido);
      return responder(pedido);
    },
  });
  return { cliente, pedidos };
}
