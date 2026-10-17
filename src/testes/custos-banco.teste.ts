import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";
import { apiFalsa, emJson, erroDaApi, mensagem, type PedidoRecebido } from "./anthropic-falsa";
import { deDataLocal, deHorarioLocal } from "@/lib/formato";
import {
  carregarMovimento,
  definirNatureza,
  gravarClassificacoes,
  nomesParaOcultar,
} from "@/lib/custos/operacoes";
import { montarResumoDeCustos } from "@/lib/custos/calculo";
import { registrarPagamento, salvarColaborador, lerColaborador } from "@/lib/equipe-operacoes";
import {
  atualizarUsoDeIa,
  cotaDeIa,
  devolverUsoDeIa,
  reservarUsoDeIa,
  usoDeIaNoMes,
} from "@/lib/ia/franquia";
import { TAMANHO_DO_LOTE, classificarComFranquia, type ItemParaIA } from "@/lib/ia/classificar-custos";

const AGORA = new Date("2026-10-15T15:00:00.000Z");

async function saida(usuarioId: string, descricao: string, valorCentavos: number, dia = "2026-10-10", extra = {}) {
  const db = await banco();
  return db.lancamento.create({
    data: { usuarioId, tipo: "saida", descricao, valorCentavos, data: deDataLocal(dia)!, ...extra },
  });
}

describe.skipIf(!TEM_BANCO)("custos no banco", () => {
  let um: Awaited<ReturnType<typeof montarEstudio>>;
  let outro: Awaited<ReturnType<typeof montarEstudio>>;

  beforeEach(async () => {
    await limpar();
    um = await montarEstudio("um");
    outro = await montarEstudio("outro");
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  describe("movimento do mês", () => {
    it("soma a receita como Finanças (atendimento concluído + entrada) e conta o mês no fuso do estúdio", async () => {
      const db = await banco();
      await db.agendamento.update({ where: { id: um.agendamento.id }, data: { status: "concluido" } });
      // 30/09 às 23h em São Paulo já é 01/10 em UTC: conta em setembro.
      await db.agendamento.create({
        data: {
          usuarioId: um.usuario.id,
          clienteId: um.cliente.id,
          servicoId: um.servico.id,
          inicio: deHorarioLocal("2026-09-30T23:00")!,
          status: "concluido",
        },
      });
      // Agendado e não concluído não é receita.
      await db.agendamento.create({
        data: {
          usuarioId: um.usuario.id,
          clienteId: um.cliente.id,
          servicoId: um.servico.id,
          inicio: deHorarioLocal("2026-10-20T10:00")!,
        },
      });
      await db.lancamento.create({
        data: {
          usuarioId: um.usuario.id,
          tipo: "entrada",
          descricao: "Venda de produto",
          valorCentavos: 5_000,
          data: deDataLocal("2026-10-03")!,
        },
      });
      await saida(um.usuario.id, "Aluguel", 180_000, "2026-10-05", {
        natureza: "fixo",
        naturezaOrigem: "voce",
      });
      await saida(outro.usuario.id, "Aluguel do outro", 999_999);

      const movimento = await carregarMovimento(db, um.usuario.id, "2026-10");
      const resumo = montarResumoDeCustos({ mes: "2026-10", ...movimento });

      expect(resumo.receitaCentavos).toBe(12_000 + 5_000);
      expect(resumo.atendimentos).toBe(1);
      expect(resumo.mesAnterior.receitaCentavos).toBe(12_000);
      expect(resumo.fixosCentavos).toBe(180_000);
      expect(resumo.despesas.map((d) => d.descricao)).toEqual(["Aluguel"]);
      expect(resumo.despesas[0]).toMatchObject({ natureza: "fixo", origem: "voce", dia: "2026-10-05" });
    });
  });

  describe("separação entre estúdios", () => {
    it("um estúdio não lê as despesas do outro", async () => {
      const db = await banco();
      await saida(outro.usuario.id, "Aluguel do outro", 50_000);
      const movimento = await carregarMovimento(db, um.usuario.id, "2026-10");
      expect(movimento.despesas).toHaveLength(0);
    });

    it("um estúdio não muda a natureza da despesa do outro", async () => {
      const db = await banco();
      const alheia = await saida(outro.usuario.id, "Aluguel do outro", 50_000);

      expect(await definirNatureza(db, um.usuario.id, alheia.id, "variavel")).toBe(false);
      expect(
        await gravarClassificacoes(db, um.usuario.id, [{ id: alheia.id, natureza: "fixo", motivo: "x" }], "ia"),
      ).toBe(0);

      const intacta = await db.lancamento.findUnique({ where: { id: alheia.id } });
      expect(intacta).toMatchObject({ natureza: null, naturezaOrigem: null });
    });

    it("os nomes a esconder são só os do próprio estúdio", async () => {
      const db = await banco();
      const nomes = await nomesParaOcultar(db, um.usuario.id);
      expect(nomes).toContain("Dona um");
      expect(nomes).toContain("Cliente de um");
      expect(nomes.join(" ")).not.toContain("outro");
    });

    it("um estúdio não mexe na reserva de IA do outro", async () => {
      const db = await banco();
      const reserva = await reservarUsoDeIa(db, {
        usuarioId: outro.usuario.id,
        recurso: "classificacao",
        limite: 10,
        unidades: 3,
        agora: AGORA,
      });
      if (!reserva.ok) throw new Error("reserva deveria passar");

      const uso = { input_tokens: 999, output_tokens: 999 };
      expect(await atualizarUsoDeIa(db, { id: reserva.id, usuarioId: um.usuario.id, usos: [uso] })).toBe(false);
      expect(await devolverUsoDeIa(db, { id: reserva.id, usuarioId: um.usuario.id, unidades: 3 })).toBe(0);

      const linha = await db.usoDeIa.findUnique({ where: { id: reserva.id } });
      expect(linha).toMatchObject({ unidades: 3, tokensEntrada: 0 });
      // E a franquia de um não conta o uso do outro.
      expect(await usoDeIaNoMes(db, um.usuario.id, "classificacao", AGORA)).toBe(0);
    });
  });

  describe("classificação", () => {
    it("regra e IA nunca passam por cima do que a dona marcou", async () => {
      const db = await banco();
      const marcada = await saida(um.usuario.id, "Aluguel do depósito", 40_000);
      await definirNatureza(db, um.usuario.id, marcada.id, "variavel");

      const gravadas = await gravarClassificacoes(
        db,
        um.usuario.id,
        [{ id: marcada.id, natureza: "fixo", motivo: "Aluguel." }],
        "regra",
      );
      expect(gravadas).toBe(0);
      const depois = await db.lancamento.findUnique({ where: { id: marcada.id } });
      expect(depois).toMatchObject({ natureza: "variavel", naturezaOrigem: "voce" });
    });

    it("a dona pode apagar a classificação e entrada não ganha natureza", async () => {
      const db = await banco();
      const despesa = await saida(um.usuario.id, "Aluguel", 40_000, "2026-10-10", {
        natureza: "fixo",
        naturezaOrigem: "regra",
        naturezaMotivo: "Aluguel.",
      });
      expect(await definirNatureza(db, um.usuario.id, despesa.id, "nenhuma")).toBe(true);
      expect(await db.lancamento.findUnique({ where: { id: despesa.id } })).toMatchObject({
        natureza: null,
        naturezaOrigem: null,
        naturezaMotivo: null,
      });

      const entrada = await db.lancamento.create({
        data: {
          usuarioId: um.usuario.id,
          tipo: "entrada",
          descricao: "Venda",
          valorCentavos: 1_000,
          data: deDataLocal("2026-10-10")!,
        },
      });
      expect(await definirNatureza(db, um.usuario.id, entrada.id, "fixo")).toBe(false);
      // E o próprio banco recusa, se alguém tentar por fora.
      await expect(
        db.lancamento.update({ where: { id: entrada.id }, data: { natureza: "fixo", naturezaOrigem: "voce" } }),
      ).rejects.toThrow();
      await expect(
        db.lancamento.update({ where: { id: despesa.id }, data: { natureza: "quarta", naturezaOrigem: "voce" } }),
      ).rejects.toThrow();
    });

    it("pagamento da Equipe já nasce com a natureza", async () => {
      const db = await banco();
      const lida = lerColaborador(
        (campo) =>
          ({ nome: "Juliana Prado", vinculo: "parceria", inicio: "2026-01-05", percentual: "40" })[campo] ?? "",
      );
      if ("erro" in lida) throw new Error(lida.erro);
      const pessoa = await salvarColaborador(db, um.usuario.id, lida);
      if ("erro" in pessoa) throw new Error(pessoa.erro);

      const pago = await registrarPagamento(db, um.usuario.id, {
        colaboradorId: pessoa.id,
        tipo: "cota_parte",
        competencia: "2026-10",
        valorCentavos: 48_000,
        pagoEm: "2026-10-31",
      });
      if ("erro" in pago) throw new Error(pago.erro);

      const lancamento = await db.lancamento.findUnique({ where: { id: pago.lancamentoId } });
      expect(lancamento).toMatchObject({ natureza: "variavel", naturezaOrigem: "regra" });
    });
  });

  describe("franquia de IA", () => {
    it("duas reservas ao mesmo tempo com limite 1: só uma passa", async () => {
      const db = await banco();
      const pedido = { usuarioId: um.usuario.id, recurso: "classificacao" as const, limite: 1, agora: AGORA };
      const resultados = await Promise.all([reservarUsoDeIa(db, pedido), reservarUsoDeIa(db, pedido)]);

      expect(resultados.filter((r) => r.ok)).toHaveLength(1);
      expect(resultados.filter((r) => !r.ok)).toEqual([{ ok: false, restantes: 0 }]);
      expect(await db.usoDeIa.count({ where: { usuarioId: um.usuario.id } })).toBe(1);
    });

    it("muitas reservas em paralelo não furam o limite", async () => {
      const db = await banco();
      const pedido = { usuarioId: um.usuario.id, recurso: "assistente" as const, limite: 3, agora: AGORA };
      const resultados = await Promise.all(Array.from({ length: 8 }, () => reservarUsoDeIa(db, pedido)));
      expect(resultados.filter((r) => r.ok)).toHaveLength(3);
      expect(await usoDeIaNoMes(db, um.usuario.id, "assistente", AGORA)).toBe(3);
    });

    it("conta o mês no fuso do estúdio e diz quanto ainda cabe", async () => {
      const db = await banco();
      // 30/09 às 23h em São Paulo: é setembro, não entra na conta de outubro.
      await db.usoDeIa.create({
        data: {
          usuarioId: um.usuario.id,
          recurso: "classificacao",
          unidades: 50,
          criadoEm: deHorarioLocal("2026-09-30T23:00")!,
        },
      });
      const primeira = await reservarUsoDeIa(db, {
        usuarioId: um.usuario.id,
        recurso: "classificacao",
        limite: 10,
        unidades: 7,
        agora: AGORA,
      });
      expect(primeira.ok).toBe(true);

      const segunda = await reservarUsoDeIa(db, {
        usuarioId: um.usuario.id,
        recurso: "classificacao",
        limite: 10,
        unidades: 5,
        agora: AGORA,
      });
      expect(segunda).toEqual({ ok: false, restantes: 3 });
      expect(await cotaDeIa(db, um.usuario.id, "classificacao", 10, AGORA)).toEqual({
        limite: 10,
        usados: 7,
        restantes: 3,
      });
    });

    it("grava os tokens e devolve o que não foi enviado", async () => {
      const db = await banco();
      const reserva = await reservarUsoDeIa(db, {
        usuarioId: um.usuario.id,
        recurso: "classificacao",
        limite: 10,
        unidades: 5,
        agora: AGORA,
      });
      if (!reserva.ok) throw new Error("reserva deveria passar");

      await atualizarUsoDeIa(db, {
        id: reserva.id,
        usuarioId: um.usuario.id,
        usos: [
          { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 5 },
          { input_tokens: 50, output_tokens: 10, server_tool_use: { web_search_requests: 2 } },
        ],
      });
      expect(await devolverUsoDeIa(db, { id: reserva.id, usuarioId: um.usuario.id, unidades: 2 })).toBe(2);
      expect(await db.usoDeIa.findUnique({ where: { id: reserva.id } })).toMatchObject({
        unidades: 3,
        tokensEntrada: 150,
        tokensSaida: 30,
        tokensCacheLeitura: 5,
        buscasNaWeb: 2,
      });

      expect(await devolverUsoDeIa(db, { id: reserva.id, usuarioId: um.usuario.id, unidades: 3 })).toBe(3);
      expect(await db.usoDeIa.findUnique({ where: { id: reserva.id } })).toBeNull();
    });
  });

  describe("classificação com franquia e a API de mentira", () => {
    function despesas(n: number) {
      return Array.from({ length: n }, (_, i) => ({
        id: `lanc-${i + 1}`,
        descricao: i === 1 ? "Despesa que a IA recusa" : `Despesa ${i + 1}`,
        categoria: null,
        valorCentavos: 1_000 * (i + 1),
        mes: "2026-10",
        dia: "2026-10-10",
        natureza: null,
        origem: null,
        motivo: null,
        daEquipe: false,
      }));
    }

    /** Recusa qualquer lote que tenha a despesa marcada; classifica o resto como variável. */
    function recusaUma(pedido: PedidoRecebido) {
      const mensagens = pedido.corpo.messages as { content: string }[];
      const itens = (JSON.parse(mensagens[0].content) as { despesas: ItemParaIA[] }).despesas;
      if (itens.some((item) => item.descricao.includes("recusa"))) return emJson(mensagem(null, "refusal"));
      return emJson(
        mensagem(JSON.stringify({ itens: itens.map((i) => ({ id: i.id, natureza: "variavel", motivo: "Ok." })) })),
      );
    }

    it("a recusa de uma despesa não trava o lote, e o uso fica contado", async () => {
      const db = await banco();
      const { cliente, pedidos } = apiFalsa(recusaUma);
      const resultado = await classificarComFranquia(db, {
        cliente,
        modelo: "claude-sonnet-5-5",
        usuarioId: um.usuario.id,
        limite: 300,
        despesas: despesas(3),
        maximo: 180,
        anteriores: new Set(),
      });

      expect(resultado.recusadas).toEqual(["lanc-2"]);
      expect(resultado.sugestoes.map((s) => s.lancamentoId).sort()).toEqual(["lanc-1", "lanc-3"]);
      expect(resultado.enviados).toBe(3);
      expect(resultado.erro).toBeNull();
      // Um pedido com o lote inteiro e um por parte depois da divisão.
      expect(pedidos).toHaveLength(4);

      const linhas = await db.usoDeIa.findMany({ where: { usuarioId: um.usuario.id } });
      expect(linhas).toHaveLength(1);
      expect(linhas[0]).toMatchObject({ recurso: "classificacao", unidades: 3, tokensEntrada: 400 });
    });

    it("entrega cada lote assim que ele termina, e uma falha ao gravar não derruba os outros", async () => {
      const db = await banco();
      const { cliente, pedidos } = apiFalsa(recusaUma);
      const entregues: string[][] = [];
      let primeira = true;
      const resultado = await classificarComFranquia(db, {
        cliente,
        usuarioId: um.usuario.id,
        limite: 300,
        // A despesa recusada é a 2ª: o 1º lote se divide, o 2º não.
        despesas: despesas(TAMANHO_DO_LOTE + 5),
        maximo: 180,
        anteriores: new Set(),
        aoTerminarLote: async (sugestoes) => {
          entregues.push(sugestoes.map((s) => s.lancamentoId));
          if (primeira) {
            primeira = false;
            throw new Error("banco fora do ar");
          }
        },
      });

      expect(entregues).toHaveLength(2);
      expect(entregues.flat()).toHaveLength(TAMANHO_DO_LOTE + 4);
      expect(resultado.sugestoes).toHaveLength(TAMANHO_DO_LOTE + 4);
      expect(resultado.recusadas).toEqual(["lanc-2"]);
      expect(resultado.erro).toMatch(/parte das sugestões/);
      expect(pedidos.length).toBeGreaterThan(2);
    });

    it("quando a franquia não cobre tudo, manda só o que cabe", async () => {
      const db = await banco();
      const { cliente, pedidos } = apiFalsa(recusaUma);
      const resultado = await classificarComFranquia(db, {
        cliente,
        usuarioId: um.usuario.id,
        limite: 1,
        despesas: despesas(3),
        maximo: 180,
        anteriores: new Set(),
      });
      expect(resultado.limitadoPelaFranquia).toBe(true);
      expect(resultado.enviados).toBe(1);
      expect(resultado.sugestoes.map((s) => s.lancamentoId)).toEqual(["lanc-1"]);
      expect(pedidos).toHaveLength(1);
    });

    it("se a API recusar o pedido sem cobrar, a franquia volta inteira", async () => {
      const db = await banco();
      const { cliente } = apiFalsa(() => erroDaApi(429, "rate_limit_error"));
      const resultado = await classificarComFranquia(db, {
        cliente,
        usuarioId: um.usuario.id,
        limite: 300,
        despesas: despesas(3),
        maximo: 180,
        anteriores: new Set(),
      });
      expect(resultado.erro).toMatch(/Muitos pedidos/);
      expect(resultado.enviados).toBe(0);
      expect(await usoDeIaNoMes(db, um.usuario.id, "classificacao")).toBe(0);
    });

    it("franquia zerada: nem chama a API", async () => {
      const db = await banco();
      const { cliente, pedidos } = apiFalsa(recusaUma);
      const resultado = await classificarComFranquia(db, {
        cliente,
        usuarioId: um.usuario.id,
        limite: 0,
        despesas: despesas(2),
        maximo: 180,
        anteriores: new Set(),
      });
      expect(resultado).toMatchObject({ limitadoPelaFranquia: true, enviados: 0 });
      expect(pedidos).toHaveLength(0);
    });
  });
});
