import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import type { EventoAssistente } from "@/lib/assistente/protocolo";
import {
  apiEmFila,
  blocoDeFerramenta,
  blocoDeRaciocinio,
  blocoDeTexto,
  erroDaApi,
  fimDaMensagem,
  inicioDaMensagem,
  sse,
} from "@/testes/anthropic-falsa";
import {
  fecharPendencias,
  fontesDoConteudo,
  historicoParaApi,
  mensagensParaTela,
  MENSAGEM_DE_RECUSA,
  prepararParaReenvio,
  rodarVolta,
  textoVisivel,
  tituloDaConversa,
  type LinhaDeMensagem,
  type OpcoesDaVolta,
} from "./assistente";

type Mensagem = Anthropic.Beta.BetaMessageParam;

function opcoes(cliente: Anthropic, extra: Partial<OpcoesDaVolta> = {}) {
  const eventos: EventoAssistente[] = [];
  const base: OpcoesDaVolta = {
    sistema: "sistema fixo",
    ferramentas: [{ name: "resumo_financeiro", description: "d", input_schema: { type: "object" } }],
    mensagens: [{ role: "user", content: [{ type: "text", text: "Como foi setembro?" }] }],
    emitir: (e) => eventos.push(e),
    statusDe: (nome) => (nome === "web_search" ? "Pesquisando tendências…" : nome === "resumo_financeiro" ? "Lendo o financeiro…" : null),
    cliente,
    modelo: "claude-sonnet-5-5",
    ...extra,
  };
  return { base, eventos };
}

describe("uma volta do assistente", () => {
  it("tool_use: mostra o status, devolve o pedido da ferramenta e não roda nada sozinha", async () => {
    const { cliente, pedidos } = apiEmFila([
      () =>
        sse([
          inicioDaMensagem("a"),
          ...blocoDeRaciocinio(0, "assinatura-1"),
          ...blocoDeFerramenta(1, "tu1", "resumo_financeiro", '{"inicio":"2026-09-01","fim":"2026-09-30"}'),
          ...fimDaMensagem("tool_use"),
        ]),
    ]);
    const { base, eventos } = opcoes(cliente);

    const resultado = await rodarVolta(base);

    expect(resultado.tipo).toBe("resposta");
    if (resultado.tipo !== "resposta") return;
    expect(resultado.motivo).toBe("tool_use");
    expect(resultado.pedidos.map((p) => p.input)).toEqual([{ inicio: "2026-09-01", fim: "2026-09-30" }]);
    // O raciocínio assinado fica no conteúdo, para voltar intacto na próxima volta.
    expect(resultado.conteudo[0]).toMatchObject({ type: "thinking", signature: "assinatura-1" });
    expect(eventos).toEqual([{ tipo: "status", mensagem: "Lendo o financeiro…" }]);

    // Um pedido só, com a configuração do projeto.
    expect(pedidos).toHaveLength(1);
    const corpo = pedidos[0].corpo;
    expect(corpo).toMatchObject({
      model: "claude-sonnet-5-5",
      system: "sistema fixo",
      stream: true,
      fallbacks: "default",
      output_config: { effort: "medium" },
      cache_control: { type: "ephemeral" },
    });
    expect(corpo).not.toHaveProperty("thinking");
    expect(corpo).not.toHaveProperty("tool_choice");
    expect(pedidos[0].cabecalhos.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
  });

  it("modelo sem fallback padrão: o pedido vai sem `fallbacks` em vez de dar erro 400", async () => {
    const { cliente, pedidos } = apiEmFila([
      () => sse([inicioDaMensagem("a"), ...blocoDeTexto(0, "Oi."), ...fimDaMensagem("end_turn")]),
    ]);
    await rodarVolta(opcoes(cliente, { modelo: "claude-haiku-5-5" }).base);
    expect(pedidos[0].corpo).not.toHaveProperty("fallbacks");
  });

  it("pause_turn e texto em pedaços: o texto chega aos poucos e volta parágrafo novo depois da pesquisa", async () => {
    const { cliente } = apiEmFila([
      () =>
        sse([
          inicioDaMensagem("a"),
          ...blocoDeTexto(0, "Vou ", "pesquisar."),
          ...blocoDeFerramenta(1, "srv1", "web_search", '{"query":"salão de beleza Cuiabá tendências"}', true),
          ...blocoDeTexto(2, "Achei duas tendências."),
          ...fimDaMensagem("pause_turn"),
        ]),
    ]);
    const { base, eventos } = opcoes(cliente);
    const resultado = await rodarVolta(base);

    expect(resultado).toMatchObject({ tipo: "resposta", motivo: "pause_turn", pedidos: [] });
    expect(eventos).toEqual([
      { tipo: "texto", delta: "Vou " },
      { tipo: "texto", delta: "pesquisar." },
      { tipo: "status", mensagem: "Pesquisando tendências…" },
      { tipo: "texto", delta: "\n\n" },
      { tipo: "texto", delta: "Achei duas tendências." },
    ]);
    // O que a tela monta ao vivo é igual ao texto gravado.
    if (resultado.tipo === "resposta") {
      expect(textoVisivel(resultado.conteudo)).toBe("Vou pesquisar.\n\nAchei duas tendências.");
    }
  });

  it("recusa: devolve a recusa com o uso (os tokens contam), sem o texto parcial", async () => {
    const { cliente } = apiEmFila([
      () => sse([inicioDaMensagem("a"), ...blocoDeTexto(0, "Começo"), ...fimDaMensagem("refusal")]),
    ]);
    const resultado = await rodarVolta(opcoes(cliente).base);
    expect(resultado.tipo).toBe("recusa");
    if (resultado.tipo === "recusa") expect(resultado.uso.input_tokens).toBe(100);
  });

  it("max_tokens com tool_use cortado: devolve o motivo, e quem chama não executa nada", async () => {
    const { cliente } = apiEmFila([
      () =>
        sse([
          inicioDaMensagem("a"),
          ...blocoDeTexto(0, "Setembro fechou com R$ 12.500,00."),
          ...blocoDeFerramenta(1, "tu1", "resumo_financeiro", '{"inicio":"2026-'),
          ...fimDaMensagem("max_tokens"),
        ]),
    ]);
    const resultado = await rodarVolta(opcoes(cliente).base);
    expect(resultado).toMatchObject({ tipo: "resposta", motivo: "max_tokens" });
  });

  it("erro da API vira erro em português, com a dica se adianta tentar de novo", async () => {
    const { cliente } = apiEmFila([() => erroDaApi(529, "overloaded_error")]);
    const resultado = await rodarVolta(opcoes(cliente).base);
    expect(resultado).toMatchObject({ tipo: "erro", erro: { codigo: "sobrecarga", repetivel: true } });
  });

  it("pedido parado pela pessoa é cancelamento; prazo vencido é erro de tempo", async () => {
    const parado = new AbortController();
    parado.abort();
    const { cliente } = apiEmFila([]);
    expect(await rodarVolta(opcoes(cliente, { signal: parado.signal }).base)).toEqual({ tipo: "cancelado" });

    const prazo = AbortSignal.timeout(5);
    const { cliente: lento } = apiEmFila([
      () =>
        new Promise<Response>((_, rejeitar) =>
          prazo.addEventListener("abort", () => rejeitar(new DOMException("abortado", "AbortError"))),
        ),
    ]);
    const resultado = await rodarVolta(opcoes(lento, { signal: prazo }).base);
    expect(resultado).toMatchObject({ tipo: "erro", erro: { codigo: "tempo", repetivel: true } });
  });
});

describe("histórico enviado à API", () => {
  const linha = (
    ordem: number,
    papel: "user" | "assistant",
    conteudo: Mensagem["content"],
    extra: Partial<LinhaDeMensagem> = {},
  ): LinhaDeMensagem => ({
    id: `m${ordem}`,
    ordem,
    papel,
    conteudo,
    textoNaTela: null,
    motivoParada: null,
    situacao: null,
    descartada: false,
    ...extra,
  });
  const pergunta = (ordem: number, texto: string, situacao: string, extra: Partial<LinhaDeMensagem> = {}) =>
    linha(ordem, "user", [{ type: "text", text: texto }], { textoNaTela: texto, situacao, ...extra });

  it("pergunta encerrada no meio: tira tool_use e server_tool_use sem par, e o raciocínio da mensagem que mudou", () => {
    const mensagens: Mensagem[] = [
      { role: "user", content: "Como foi?" },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "", signature: "s0" },
          { type: "text", text: "Vou pesquisar." },
          { type: "server_tool_use", id: "srv1", name: "web_search", input: {} },
        ],
      },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "", signature: "s" },
          { type: "tool_use", id: "tu1", name: "resumo_financeiro", input: {} },
        ],
      },
    ];
    const fechado = fecharPendencias(mensagens);
    expect(fechado).toHaveLength(2);
    expect(fechado[1].content).toEqual([{ type: "text", text: "Vou pesquisar." }]);
  });

  it("não mexe no que não tem pendência (os bytes enviados continuam iguais)", () => {
    const mensagens: Mensagem[] = [
      { role: "user", content: "Como foi?" },
      { role: "assistant", content: [{ type: "tool_use", id: "tu1", name: "resumo_financeiro", input: {} }] },
      { role: "user", content: [{ type: "tool_result", tool_use_id: "tu1", content: "{}" }] },
      { role: "assistant", content: [{ type: "text", text: "Pronto." }] },
    ];
    expect(fecharPendencias(mensagens)).toEqual(mensagens);
  });

  it("deixa de fora o que foi descartado e só fecha as perguntas que já acabaram", () => {
    const linhas: LinhaDeMensagem[] = [
      pergunta(0, "Primeira", "cortada"),
      linha(1, "assistant", [
        { type: "text", text: "Parcial" },
        { type: "tool_use", id: "tu1", name: "resumo_financeiro", input: {} },
      ]),
      pergunta(2, "Recusada", "recusada", { descartada: true }),
      linha(3, "assistant", [{ type: "text", text: "nada" }], { descartada: true }),
      pergunta(4, "Atual", "andamento"),
      linha(5, "assistant", [{ type: "server_tool_use", id: "srv9", name: "web_search", input: {} }], {
        motivoParada: "pause_turn",
      }),
    ];
    const historico = historicoParaApi(linhas, true);
    expect(historico.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(historico[1].content).toEqual([{ type: "text", text: "Parcial" }]);
    // A pergunta em andamento vai intacta: a retomada do pause_turn precisa do server_tool_use.
    expect(historico[3].content).toEqual([{ type: "server_tool_use", id: "srv9", name: "web_search", input: {} }]);
    expect(JSON.stringify(historico)).not.toContain("Recusada");
  });

  it("a tela recebe só texto visível, fontes https e o recado de cada situação", () => {
    const linhas: LinhaDeMensagem[] = [
      pergunta(0, "O que está em alta?", "concluida"),
      linha(1, "assistant", [{ type: "thinking", thinking: "segredo", signature: "s" }, { type: "text", text: "Antes." }], {
        textoNaTela: "Antes.",
      }),
      linha(2, "assistant", [
        {
          type: "text",
          text: "Escova está em alta.",
          citations: [
            { type: "web_search_result_location", url: "https://exemplo.com.br/a", title: "Tendências", encrypted_index: "x", cited_text: "c" },
            { type: "web_search_result_location", url: "http://inseguro.com/b", title: "Inseguro", encrypted_index: "x", cited_text: "c" },
          ],
        },
      ], { textoNaTela: "Escova está em alta." }),
      pergunta(3, "Pergunta recusada", "recusada", { descartada: true }),
      pergunta(4, "Pela metade", "andamento"),
    ];
    const tela = mensagensParaTela(linhas);
    expect(tela.map((m) => m.papel)).toEqual(["usuario", "assistente", "usuario", "assistente", "usuario", "assistente"]);
    expect(tela[1].texto).toBe("Antes.\n\nEscova está em alta.");
    expect(tela[1].fontes).toEqual([{ url: "https://exemplo.com.br/a", titulo: "Tendências" }]);
    expect(JSON.stringify(tela)).not.toContain("segredo");
    expect(tela[3]).toMatchObject({ texto: "", aviso: MENSAGEM_DE_RECUSA });
    expect(tela[5]).toMatchObject({ podeContinuar: true });
  });

  it("fontes só de citação da web e sem repetir endereço", () => {
    const content = [
      {
        type: "text" as const,
        text: "a",
        citations: [
          { type: "web_search_result_location" as const, url: "https://a.com", title: "A", encrypted_index: "", cited_text: "" },
          { type: "web_search_result_location" as const, url: "https://a.com", title: "A", encrypted_index: "", cited_text: "" },
        ],
      },
    ];
    expect(fontesDoConteudo(content)).toEqual([{ url: "https://a.com", titulo: "A" }]);
  });

  it("depois de um fallback, tira raciocínio e ferramentas pendentes de antes da troca", () => {
    const content = [
      { type: "thinking", thinking: "", signature: "s" },
      { type: "text", text: "Começo", citations: null },
      { type: "tool_use", id: "tu1", name: "x", input: {} },
      { type: "fallback", from: { model: "a" }, to: { model: "b" }, trigger: "refusal" },
      { type: "text", text: "Resto", citations: null },
    ] as unknown as Anthropic.Beta.BetaContentBlock[];
    expect(prepararParaReenvio(content).map((b) => b.type)).toEqual(["text", "fallback", "text"]);
  });

  it("título da conversa curto e sem documento nem contato", () => {
    expect(tituloDaConversa("  Meu CPF é 123.456.789-09, como foi setembro? ")).toBe(
      "Meu CPF é [cpf], como foi setembro?",
    );
    expect(tituloDaConversa("a".repeat(200))).toHaveLength(80);
    expect(tituloDaConversa("   ")).toBe("Nova conversa");
  });
});
