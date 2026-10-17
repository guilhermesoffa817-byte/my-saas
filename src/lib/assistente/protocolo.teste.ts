import { describe, expect, it } from "vitest";
import { interpretarMarkdown, interpretarTrechos } from "./markdown";
import { codificarEvento, lerEventos, lerPedido, perguntaDoLink, separarEventos } from "./protocolo";

describe("pedido ao assistente", () => {
  it("aceita só as duas ações, com id no formato do banco", () => {
    expect(lerPedido({ acao: "perguntar", pergunta: "  Como foi?  " })).toEqual({
      ok: true,
      pedido: { acao: "perguntar", pergunta: "Como foi?" },
    });
    expect(lerPedido({ acao: "continuar", conversaId: "cmgabc1234567890xyz" })).toMatchObject({ ok: true });
    expect(lerPedido({ acao: "continuar" }).ok).toBe(false);
    expect(lerPedido({ acao: "perguntar", pergunta: "   " }).ok).toBe(false);
    expect(lerPedido({ acao: "perguntar", pergunta: "x".repeat(2001) }).ok).toBe(false);
    expect(lerPedido({ acao: "perguntar", pergunta: "Oi", conversaId: "'; drop table" }).ok).toBe(false);
    expect(lerPedido({ acao: "apagar", conversaId: "cmgabc1234567890xyz" }).ok).toBe(false);
    expect(lerPedido("texto").ok).toBe(false);
  });

  it("pergunta do endereço só preenche o campo, no tamanho certo", () => {
    expect(perguntaDoLink(" Como foi meu último mês? ")).toBe("Como foi meu último mês?");
    expect(perguntaDoLink(["a", "b"])).toBeNull();
    expect(perguntaDoLink("   ")).toBeNull();
    expect(perguntaDoLink("x".repeat(3000))).toHaveLength(2000);
  });
});

describe("eventos NDJSON", () => {
  it("separa eventos que chegam quebrados em qualquer ponto e ignora linha estranha", async () => {
    const texto =
      codificarEvento({ tipo: "texto", delta: "Olá" }) +
      "lixo\n" +
      codificarEvento({ tipo: "fim", salvo: true, continuar: false, cota: null });
    const { eventos, resto } = separarEventos(texto.slice(0, 20));
    expect(eventos).toEqual([]);
    expect(resto).toBe(texto.slice(0, 20));

    const bytes = new TextEncoder().encode(texto);
    const corpo = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7));
        controller.close();
      },
    });
    const recebidos: unknown[] = [];
    await lerEventos(corpo, (e) => recebidos.push(e));
    expect(recebidos).toEqual([
      { tipo: "texto", delta: "Olá" },
      { tipo: "fim", salvo: true, continuar: false, cota: null },
    ]);
  });
});

describe("markdown da resposta", () => {
  it("monta parágrafos, títulos, listas e negrito como estrutura", () => {
    const blocos = interpretarMarkdown("## Resumo\nSetembro foi **bom**.\n\n- Um\n- Dois\n\n1. Primeiro\n2. Segundo");
    expect(blocos.map((b) => b.tipo)).toEqual(["titulo", "paragrafo", "lista", "lista"]);
    expect(blocos[1]).toEqual({
      tipo: "paragrafo",
      trechos: [
        { tipo: "texto", texto: "Setembro foi " },
        { tipo: "negrito", texto: "bom" },
        { tipo: "texto", texto: "." },
      ],
    });
  });

  it("só vira link o endereço https; javascript: e http ficam como texto", () => {
    expect(interpretarTrechos("[fonte](https://exemplo.com.br/a).")).toEqual([
      { tipo: "link", texto: "fonte", url: "https://exemplo.com.br/a" },
      { tipo: "texto", texto: "." },
    ]);
    expect(interpretarTrechos("[clique](javascript:alert(1))")).not.toContainEqual(
      expect.objectContaining({ tipo: "link" }),
    );
    expect(interpretarTrechos("[site](http://inseguro.com)")).toEqual([{ tipo: "texto", texto: "site" }]);
    expect(interpretarTrechos("<img src=x onerror=alert(1)>")).toEqual([
      { tipo: "texto", texto: "<img src=x onerror=alert(1)>" },
    ]);
  });
});
