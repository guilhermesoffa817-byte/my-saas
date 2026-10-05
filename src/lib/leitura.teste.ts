import { describe, expect, it, vi } from "vitest";
import { conferir, lerDocumento, type ClienteDaLeitura } from "@/lib/leitura";
import { paraDataPura } from "@/lib/formato";

/** Um cliente de mentira: devolve o que o teste mandar, sem rede e sem chave. */
function clienteDeMentira(resposta: unknown, paradaPor = "end_turn"): ClienteDaLeitura {
  return {
    messages: {
      create: vi.fn(async () => ({
        stop_reason: paradaPor,
        content: [{ type: "text", text: JSON.stringify(resposta) }],
      })),
    },
  };
}

const ARQUIVO = [{ base64: "ZmFrZQ==", tipo: "application/pdf" }];

const RESPOSTA_BOA = {
  documento: {
    tipo: "Contrato de aluguel",
    partes: "Imobiliária Central e Estúdio Bela Pele",
    resumo: "Aluguel de sala comercial por 24 meses, com reajuste anual.",
    fimDoContrato: "2027-12-31",
    reajusteEm: "2026-12-01",
    indiceDeReajuste: "IGP-M",
    multa: "Três aluguéis",
    avisoPrevio: "30 dias",
  },
  itens: [
    {
      descricao: "Aluguel",
      tipo: "saida",
      valorCentavos: 800000,
      data: "2026-10-30",
      repeticao: "mensal",
      repeteAte: "2027-12-31",
      trecho: "O locatário pagará R$ 8.000,00 todo dia 30.",
      pagina: 2,
      duvidoso: false,
    },
  ],
};

describe("leitura de documento", () => {
  it("entende uma resposta bem formada", async () => {
    const leitura = await lerDocumento({
      cliente: clienteDeMentira(RESPOSTA_BOA),
      arquivos: ARQUIVO,
    });

    expect(leitura.certo).toBe(true);
    if (!leitura.certo) return;

    expect(leitura.documento.tipo).toBe("Contrato de aluguel");
    expect(leitura.documento.indiceDeReajuste).toBe("IGP-M");
    expect(paraDataPura(leitura.documento.fimDoContrato!)).toBe("2027-12-31");

    expect(leitura.itens).toHaveLength(1);
    const item = leitura.itens[0];
    expect(item.valorCentavos).toBe(800000);
    expect(paraDataPura(item.data!)).toBe("2026-10-30");
    expect(item.repeticao).toBe("mensal");
    expect(item.pagina).toBe(2);
    expect(item.trecho).toContain("R$ 8.000,00");
    expect(item.duvidoso).toBe(false);
  });

  it("manda o PDF como documento e o esquema junto", async () => {
    const cliente = clienteDeMentira(RESPOSTA_BOA);
    await lerDocumento({ cliente, arquivos: ARQUIVO });

    const pedido = (cliente.messages.create as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as Record<string, unknown>;

    expect(pedido.model).toBe("claude-sonnet-5-5");
    expect((pedido.output_config as Record<string, unknown>).format).toMatchObject({
      type: "json_schema",
    });

    const conteudo = (pedido.messages as { content: { type: string }[] }[])[0].content;
    expect(conteudo[0].type).toBe("document");
    // O anexo vem antes do texto.
    expect(conteudo.at(-1)!.type).toBe("text");
  });

  it("manda foto de página como imagem, não como documento", async () => {
    const cliente = clienteDeMentira(RESPOSTA_BOA);
    await lerDocumento({
      cliente,
      arquivos: [
        { base64: "a", tipo: "image/jpeg" },
        { base64: "b", tipo: "image/png" },
      ],
    });

    const pedido = (cliente.messages.create as ReturnType<typeof vi.fn>).mock
      .calls[0][0] as { messages: { content: { type: string }[] }[] };
    expect(pedido.messages[0].content[0].type).toBe("image");
    expect(pedido.messages[0].content[1].type).toBe("image");
  });

  it("vira 'não consegui ler' quando a leitura recusa", async () => {
    const leitura = await lerDocumento({
      cliente: clienteDeMentira({}, "refusal"),
      arquivos: ARQUIVO,
    });
    expect(leitura.certo).toBe(false);
  });

  it("vira 'não consegui ler' quando a resposta foi cortada por tamanho", async () => {
    const leitura = await lerDocumento({
      cliente: clienteDeMentira({}, "max_tokens"),
      arquivos: ARQUIVO,
    });
    expect(leitura.certo).toBe(false);
    if (leitura.certo) return;
    expect(leitura.motivo).toContain("grande demais");
  });

  it("vira 'não consegui ler' quando a API falha, sem vazar o documento no erro", async () => {
    const erros: unknown[][] = [];
    const espiao = vi.spyOn(console, "error").mockImplementation((...args) => {
      erros.push(args);
    });

    const leitura = await lerDocumento({
      cliente: {
        messages: {
          create: async () => {
            throw new Error("500 do servidor");
          },
        },
      },
      arquivos: [{ base64: "Q09OVFJBVE8gU0VDUkVUTw==", tipo: "application/pdf" }],
    });

    expect(leitura.certo).toBe(false);
    // Nenhum pedaço do arquivo pode aparecer no que foi registrado.
    const registrado = JSON.stringify(erros);
    expect(registrado).not.toContain("Q09OVFJBVE8");
    espiao.mockRestore();
  });

  it("vira 'não consegui ler' quando o texto não é JSON", async () => {
    const leitura = await lerDocumento({
      cliente: {
        messages: {
          create: async () => ({
            stop_reason: "end_turn",
            content: [{ type: "text", text: "desculpa, não consegui" }],
          }),
        },
      },
      arquivos: ARQUIVO,
    });
    expect(leitura.certo).toBe(false);
  });
});

describe("conferência do que volta", () => {
  it("recusa resposta sem a lista de itens", () => {
    expect(conferir({ documento: {} }).certo).toBe(false);
    expect(conferir(null).certo).toBe(false);
    expect(conferir("texto").certo).toBe(false);
  });

  it("joga fora data que não existe", () => {
    const lida = conferir({
      documento: { fimDoContrato: "2026-02-31" },
      itens: [{ descricao: "Aluguel", tipo: "saida", valorCentavos: 100, data: "2026-02-30", duvidoso: false }],
    });
    expect(lida.certo).toBe(true);
    if (!lida.certo) return;
    expect(lida.documento.fimDoContrato).toBeNull();
    expect(lida.itens[0].data).toBeNull();
    // E, sem data, o item nasce duvidoso.
    expect(lida.itens[0].duvidoso).toBe(true);
  });

  it("joga fora data fora de qualquer realidade", () => {
    const lida = conferir({
      documento: { fimDoContrato: "3000-01-01" },
      itens: [{ descricao: "X", tipo: "saida", valorCentavos: 100, data: "1200-01-01", duvidoso: false }],
    });
    if (!lida.certo) throw new Error("devia passar");
    expect(lida.documento.fimDoContrato).toBeNull();
    expect(lida.itens[0].data).toBeNull();
  });

  it("joga fora valor negativo, zerado, quebrado ou absurdo", () => {
    for (const ruim of [-100, 0, 1.5, 1e15, "800000", null]) {
      const lida = conferir({
        documento: {},
        itens: [{ descricao: "X", tipo: "saida", valorCentavos: ruim, data: "2026-10-10", duvidoso: false }],
      });
      if (!lida.certo) throw new Error("devia passar");
      expect(lida.itens[0].valorCentavos, `valor ${String(ruim)}`).toBeNull();
      expect(lida.itens[0].duvidoso).toBe(true);
    }
  });

  it("aceita valor e data só quando vêm os dois certos", () => {
    const lida = conferir({
      documento: {},
      itens: [{ descricao: "X", tipo: "saida", valorCentavos: 80000, data: "2026-10-10", duvidoso: false }],
    });
    if (!lida.certo) throw new Error("devia passar");
    expect(lida.itens[0].duvidoso).toBe(false);
  });

  it("descarta item sem descrição em vez de inventar uma", () => {
    const lida = conferir({
      documento: {},
      itens: [
        { descricao: "", tipo: "saida", valorCentavos: 100, data: "2026-10-10", duvidoso: false },
        { tipo: "saida", valorCentavos: 100, data: "2026-10-10", duvidoso: false },
        { descricao: "Aluguel", tipo: "saida", valorCentavos: 100, data: "2026-10-10", duvidoso: false },
      ],
    });
    if (!lida.certo) throw new Error("devia passar");
    expect(lida.itens).toHaveLength(1);
    expect(lida.itens[0].descricao).toBe("Aluguel");
  });

  it("só aceita entrada ou saida; qualquer outra coisa vira saida", () => {
    const lida = conferir({
      documento: {},
      itens: [
        { descricao: "A", tipo: "entrada", duvidoso: false },
        { descricao: "B", tipo: "transferencia", duvidoso: false },
        { descricao: "C", duvidoso: false },
      ],
    });
    if (!lida.certo) throw new Error("devia passar");
    expect(lida.itens.map((i) => i.tipo)).toEqual(["entrada", "saida", "saida"]);
  });

  it("só aceita repetição mensal, e ignora o fim quando não há repetição", () => {
    const lida = conferir({
      documento: {},
      itens: [
        { descricao: "A", tipo: "saida", repeticao: "semanal", repeteAte: "2027-01-01", duvidoso: false },
        { descricao: "B", tipo: "saida", repeticao: "mensal", repeteAte: "2027-01-01", duvidoso: false },
      ],
    });
    if (!lida.certo) throw new Error("devia passar");
    expect(lida.itens[0].repeticao).toBeNull();
    expect(lida.itens[0].repeteAte).toBeNull();
    expect(lida.itens[1].repeticao).toBe("mensal");
    expect(paraDataPura(lida.itens[1].repeteAte!)).toBe("2027-01-01");
  });

  it("corta texto comprido em vez de guardar documento inteiro num campo", () => {
    const lida = conferir({
      documento: { resumo: "a".repeat(5000) },
      itens: [{ descricao: "x".repeat(5000), tipo: "saida", trecho: "y".repeat(5000), duvidoso: false }],
    });
    if (!lida.certo) throw new Error("devia passar");
    expect(lida.documento.resumo!.length).toBeLessThanOrEqual(1200);
    expect(lida.itens[0].descricao.length).toBeLessThanOrEqual(200);
    expect(lida.itens[0].trecho!.length).toBeLessThanOrEqual(600);
  });

  it("aceita documento sem nenhum item, sem quebrar", () => {
    const lida = conferir({ documento: { tipo: "Nota fiscal" }, itens: [] });
    expect(lida.certo).toBe(true);
    if (!lida.certo) return;
    expect(lida.itens).toEqual([]);
  });
});
