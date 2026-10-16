import { describe, expect, it } from "vitest";
import type { DespesaParaCusto } from "@/lib/custos/calculo";
import { apiFalsa, emJson, erroDaApi, mensagem, type PedidoRecebido } from "@/testes/anthropic-falsa";
import {
  ESQUEMA_DA_CLASSIFICACAO,
  TAMANHO_DO_LOTE,
  chaveDaDescricao,
  classificarLote,
  descricoesAnteriores,
  emLotes,
  interpretarResposta,
  montarLote,
  type ItemParaIA,
} from "./classificar-custos";

let sequencia = 0;
function despesa(dados: Partial<DespesaParaCusto> = {}): DespesaParaCusto {
  sequencia += 1;
  return {
    id: `cl${String(sequencia).padStart(8, "0")}`,
    descricao: "Lavanderia",
    categoria: null,
    valorCentavos: 12_345,
    mes: "2026-10",
    dia: "2026-10-10",
    natureza: null,
    origem: null,
    motivo: null,
    daEquipe: false,
    ...dados,
  };
}

/** Os itens que a tela mandou, lidos de volta do corpo do pedido. */
function itensDoPedido(pedido: PedidoRecebido): ItemParaIA[] {
  const mensagens = pedido.corpo.messages as { content: string }[];
  return (JSON.parse(mensagens[0].content) as { despesas: ItemParaIA[] }).despesas;
}

/** Responde classificando tudo como fixo. */
function tudoFixo(pedido: PedidoRecebido) {
  const itens = itensDoPedido(pedido).map((item) => ({
    id: item.id,
    natureza: "fixo",
    motivo: "Se repete todo mês.",
  }));
  return emJson(mensagem(JSON.stringify({ itens })));
}

describe("montarLote", () => {
  it("limpa dado pessoal, esconde nomes, não manda id do banco e marca recorrência", () => {
    const a = despesa({
      descricao: "Reembolso para Rafael Souza — CPF 123.456.789-09, rafa@exemplo.com.br",
      categoria: "Outros",
    });
    const b = despesa({ descricao: "Lavanderia — outubro", valorCentavos: 4_990 });
    const anteriores = descricoesAnteriores([{ descricao: "Lavanderia — setembro", mes: "2026-09" }], "2026-10");

    const { itens, idPorNumero } = montarLote([a, b], anteriores, ["Rafael Souza"]);

    expect(itens[0]).toEqual({
      id: "1",
      descricao: "Reembolso para [nome] — CPF [cpf], [e-mail]",
      categoria: "Outros",
      valor_centavos: 12_345,
      valor: expect.stringMatching(/^R\$\s123,45$/),
      repete_em_meses_anteriores: false,
    });
    expect(itens[1]).toMatchObject({ id: "2", valor_centavos: 4_990, repete_em_meses_anteriores: true });
    const enviado = JSON.stringify(itens);
    expect(enviado).not.toContain(a.id);
    expect(enviado).not.toContain("Rafael");
    expect(idPorNumero.get("1")).toBe(a.id);
    expect(idPorNumero.get("2")).toBe(b.id);
  });

  it("a chave da descrição ignora mês e número", () => {
    expect(chaveDaDescricao("Aluguel — outubro/2026")).toBe(chaveDaDescricao("Aluguel - set 2026"));
  });

  it("divide em lotes do tamanho certo", () => {
    expect(emLotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(emLotes(Array.from({ length: 130 }), TAMANHO_DO_LOTE).map((l) => l.length)).toEqual([60, 60, 10]);
  });
});

describe("interpretarResposta", () => {
  it("descarta id que não foi enviado, id repetido e natureza fora da lista", () => {
    const ids = new Map([
      ["1", "lanc-a"],
      ["2", "lanc-b"],
      ["3", "lanc-c"],
    ]);
    const sugestoes = interpretarResposta(
      {
        itens: [
          { id: "1", natureza: "fixo", motivo: "Aluguel." },
          { id: "1", natureza: "variavel", motivo: "Repetido." },
          { id: "9", natureza: "fixo", motivo: "Inventado." },
          { id: "2", natureza: "quarta", motivo: "Fora da lista." },
          { id: " 3 ", natureza: "nao_operacional", motivo: "x".repeat(300) },
        ],
      },
      ids,
    );
    expect(sugestoes).toEqual([
      { lancamentoId: "lanc-a", natureza: "fixo", motivo: "Aluguel." },
      { lancamentoId: "lanc-c", natureza: "nao_operacional", motivo: "x".repeat(200) },
    ]);
  });

  it("devolve null quando a forma não é a esperada", () => {
    expect(interpretarResposta(null, new Map())).toBeNull();
    expect(interpretarResposta({ outra: [] }, new Map())).toBeNull();
  });
});

describe("classificarLote com a API de mentira", () => {
  it("monta o pedido do jeito que a API pede", async () => {
    const { cliente, pedidos } = apiFalsa(tudoFixo);
    const a = despesa({ descricao: "Curso de extensão" });
    const resultado = await classificarLote([a], new Set(), { cliente, modelo: "claude-sonnet-5-5" });

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.sugestoes).toEqual([{ lancamentoId: a.id, natureza: "fixo", motivo: "Se repete todo mês." }]);
    expect(resultado.uso.input_tokens).toBe(100);

    const [pedido] = pedidos;
    expect(pedido.url).toContain("/v1/messages?beta=true");
    expect(pedido.cabecalhos.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    expect(pedido.corpo).toMatchObject({
      model: "claude-sonnet-5-5",
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: ESQUEMA_DA_CLASSIFICACAO } },
    });
    // Regras da API: nada de thinking desligado, orçamento de raciocínio nem ferramenta forçada.
    expect(pedido.corpo).not.toHaveProperty("thinking");
    expect(pedido.corpo).not.toHaveProperty("tool_choice");
    expect(pedido.corpo).not.toHaveProperty("betas");
    expect(JSON.stringify(pedido.corpo)).not.toContain(a.id);
    const natureza = (
      ESQUEMA_DA_CLASSIFICACAO.properties.itens.items.properties.natureza as { enum: readonly string[] }
    ).enum;
    expect(natureza).toEqual(["fixo", "variavel", "nao_operacional"]);
  });

  it("sem fallback para modelo que não aceita a forma padrão", async () => {
    const { cliente, pedidos } = apiFalsa(tudoFixo);
    await classificarLote([despesa()], new Set(), { cliente, modelo: "claude-haiku-5-5" });
    expect(pedidos[0].corpo).not.toHaveProperty("fallbacks");
    expect(pedidos[0].cabecalhos.get("anthropic-beta")).toBeNull();
  });

  it("recusa vira erro 'recusa', com o uso cobrado", async () => {
    const { cliente } = apiFalsa(() => emJson(mensagem(null, "refusal")));
    const resultado = await classificarLote([despesa()], new Set(), { cliente });
    expect(resultado).toMatchObject({ ok: false, erro: { codigo: "recusa" }, uso: { input_tokens: 100 } });
  });

  it("resposta cortada por tamanho não vira classificação pela metade", async () => {
    const { cliente } = apiFalsa(() => emJson(mensagem('{"itens":[{"id":"1","natur', "max_tokens")));
    const resultado = await classificarLote([despesa()], new Set(), { cliente });
    expect(resultado).toMatchObject({ ok: false, erro: { codigo: "saida" } });
  });

  it("texto que não é JSON vira erro de saída", async () => {
    const { cliente } = apiFalsa(() => emJson(mensagem("não sei")));
    const resultado = await classificarLote([despesa()], new Set(), { cliente });
    expect(resultado).toMatchObject({ ok: false, erro: { codigo: "saida" } });
  });

  it("limite de pedidos vira erro 'limite', sem uso (nada foi cobrado)", async () => {
    const { cliente } = apiFalsa(() => erroDaApi(429, "rate_limit_error"));
    const resultado = await classificarLote([despesa()], new Set(), { cliente });
    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.erro.codigo).toBe("limite");
    expect(resultado.uso).toBeUndefined();
  });

  it("recusa lote grande demais sem chamar a API", async () => {
    const { cliente, pedidos } = apiFalsa(tudoFixo);
    const lote = Array.from({ length: TAMANHO_DO_LOTE + 1 }, () => despesa());
    const resultado = await classificarLote(lote, new Set(), { cliente });
    expect(resultado).toMatchObject({ ok: false, erro: { codigo: "pedido" } });
    expect(pedidos).toHaveLength(0);
  });
});
