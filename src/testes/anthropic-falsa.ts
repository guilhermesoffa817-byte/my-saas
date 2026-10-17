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

/* ------------------------------------------------ respostas em streaming */

export type EventoSse = Record<string, unknown> & { type: string };

/** Uso de uma chamada em streaming, como chega no message_start. */
export const usoDoStream = {
  input_tokens: 100,
  output_tokens: 20,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 50,
  server_tool_use: null,
  service_tier: "standard",
};

export function inicioDaMensagem(id: string): EventoSse {
  return {
    type: "message_start",
    message: {
      id,
      type: "message",
      role: "assistant",
      model: "claude-sonnet-5-5",
      content: [],
      stop_reason: null,
      stop_details: null,
      stop_sequence: null,
      usage: usoDoStream,
    },
  };
}

export function fimDaMensagem(motivo: string): EventoSse[] {
  const detalhes =
    motivo === "refusal" ? { type: "refusal", category: null, explanation: null, recommended_model: null } : null;
  return [
    {
      type: "message_delta",
      delta: { stop_reason: motivo, stop_details: detalhes, stop_sequence: null },
      usage: { output_tokens: 20 },
    },
    { type: "message_stop" },
  ];
}

export function blocoDeTexto(indice: number, ...partes: string[]): EventoSse[] {
  return [
    { type: "content_block_start", index: indice, content_block: { type: "text", text: "" } },
    ...partes.map((text) => ({ type: "content_block_delta", index: indice, delta: { type: "text_delta", text } })),
    { type: "content_block_stop", index: indice },
  ];
}

export function blocoDeRaciocinio(indice: number, assinatura: string): EventoSse[] {
  return [
    { type: "content_block_start", index: indice, content_block: { type: "thinking", thinking: "", signature: "" } },
    { type: "content_block_delta", index: indice, delta: { type: "signature_delta", signature: assinatura } },
    { type: "content_block_stop", index: indice },
  ];
}

export function blocoDeFerramenta(indice: number, id: string, nome: string, entrada: string, servidor = false): EventoSse[] {
  return [
    {
      type: "content_block_start",
      index: indice,
      content_block: { type: servidor ? "server_tool_use" : "tool_use", id, name: nome, input: {} },
    },
    { type: "content_block_delta", index: indice, delta: { type: "input_json_delta", partial_json: entrada } },
    { type: "content_block_stop", index: indice },
  ];
}

/** Uma resposta em SSE, como a API manda quando o pedido tem stream. */
export function sse(eventos: EventoSse[]) {
  return new Response(eventos.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join(""), {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

/** Cliente que responde aos pedidos na ordem da fila. Pedido além da fila é erro do teste. */
export function apiEmFila(respostas: (() => Response | Promise<Response>)[]) {
  const fila = [...respostas];
  return apiFalsa(() => {
    const proxima = fila.shift();
    if (!proxima) throw new Error("pedido inesperado à API");
    return proxima();
  });
}
