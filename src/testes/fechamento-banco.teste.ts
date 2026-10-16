import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";
import { deDataLocal, deDataPura } from "@/lib/formato";
import { MES_FECHADO } from "@/lib/fechamento/trava";
import { fecharMes, historicoDoMes, reabrirMes } from "@/lib/fechamento/operacoes";
import { relatorioAoVivo, relatorioDoMes } from "@/lib/relatorio/operacoes";
import { apagarLancamento, registrarLancamento } from "@/lib/financas-operacoes";
import {
  excluirPagamento,
  lerColaborador,
  registrarPagamento,
  salvarColaborador,
} from "@/lib/equipe-operacoes";
import { apagarVencimento, pagarVencimento } from "@/lib/vencimento-operacoes";
import { receberCobranca } from "@/lib/cobranca-operacoes";
import { apagarHorario, mudarStatusDoHorario } from "@/lib/agenda-operacoes";
import { apagarCliente } from "@/lib/cliente-operacoes";
import { definirNatureza } from "@/lib/custos/operacoes";

/** Um instante dado em horário de São Paulo. */
const sp = (texto: string) => new Date(`${texto}-03:00`);
const dia = (texto: string) => deDataPura(texto)!;
const AGORA = sp("2026-10-16T10:00:00");
const SETEMBRO = "2026-09";

type Estudio = Awaited<ReturnType<typeof montarEstudio>>;

/** Um estúdio com dinheiro em setembro: atendimento, entrada, saída e cobranças. */
async function comSetembro(estudio: Estudio) {
  const db = await banco();
  const usuarioId = estudio.usuario.id;

  const atendimento = await db.agendamento.create({
    data: {
      usuarioId,
      clienteId: estudio.cliente.id,
      servicoId: estudio.servico.id,
      inicio: sp("2026-09-10T14:00:00"),
      status: "concluido",
    },
  });
  const entrada = await db.lancamento.create({
    data: { usuarioId, tipo: "entrada", descricao: "Venda de produto", valorCentavos: 5000, data: sp("2026-09-12T10:00:00") },
  });
  const saida = await db.lancamento.create({
    data: {
      usuarioId,
      tipo: "saida",
      descricao: "Material",
      categoria: "Material",
      valorCentavos: 3000,
      data: sp("2026-09-15T10:00:00"),
    },
  });
  // Cobrança avulsa ainda aberta, que pode ser recebida em setembro.
  const avulsa = await db.cobranca.create({
    data: { usuarioId, clienteId: estudio.cliente.id, valorCentavos: 7000, vencimento: dia("2026-09-20") },
  });
  const conta = await db.vencimento.create({
    data: { usuarioId, descricao: "Energia", valorCentavos: 24000, data: dia("2026-09-25") },
  });
  return { atendimento, entrada, saida, avulsa, conta };
}

async function colaborador(usuarioId: string) {
  const db = await banco();
  const lida = lerColaborador(
    (campo) =>
      ({ nome: "Rafael Lima", vinculo: "clt", inicio: "2026-01-05", salario: "1.900,00" })[campo] ?? "",
  );
  if ("erro" in lida) throw new Error(lida.erro);
  const salvo = await salvarColaborador(db, usuarioId, lida);
  if ("erro" in salvo) throw new Error(salvo.erro);
  return salvo.id;
}

describe.skipIf(!TEM_BANCO)("fechamento do mês no banco", () => {
  let estudio: Estudio;

  beforeEach(async () => {
    await limpar();
    estudio = await montarEstudio("fechamento");
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("fechar guarda o resumo; o relatório do mês fechado não muda por baixo", async () => {
    const db = await banco();
    await comSetembro(estudio);

    const fechado = await fecharMes(db, estudio.usuario.id, SETEMBRO, AGORA);
    if (!("resultado" in fechado) || fechado.resultado !== "fechado") throw new Error("não fechou");
    expect(fechado.relatorio.entradas.totalCentavos).toBe(12000 + 5000);

    // Um preço de serviço que muda depois não mexe no mês fechado.
    await db.servico.update({ where: { id: estudio.servico.id }, data: { precoCentavos: 99900 } });
    const naTela = await relatorioDoMes(db, estudio.usuario.id, SETEMBRO, AGORA);
    expect(naTela.congelado).toBe(true);
    expect(naTela.relatorio.entradas.totalCentavos).toBe(17000);

    // Fechar de novo não grava outro registro.
    expect(await fecharMes(db, estudio.usuario.id, SETEMBRO, AGORA)).toEqual({ resultado: "ja_fechado" });
  });

  it("reabrir é permitido e fica registrado", async () => {
    const db = await banco();
    await fecharMes(db, estudio.usuario.id, SETEMBRO, AGORA);
    expect(await reabrirMes(db, estudio.usuario.id, SETEMBRO, sp("2026-10-17T09:00:00"))).toEqual({
      resultado: "reaberto",
    });
    await fecharMes(db, estudio.usuario.id, SETEMBRO, sp("2026-10-18T09:00:00"));

    const historico = await historicoDoMes(db, estudio.usuario.id, SETEMBRO);
    expect(historico.map((item) => item.acao)).toEqual(["fechou", "reabriu", "fechou"]);
    const linha = await db.fechamentoDoMes.findFirstOrThrow({ where: { usuarioId: estudio.usuario.id } });
    expect(linha.reabertoEm?.toISOString()).toBe(sp("2026-10-17T09:00:00").toISOString());
  });

  it("não fecha mês que ainda não começou", async () => {
    const db = await banco();
    const resposta = await fecharMes(db, estudio.usuario.id, "2026-11", AGORA);
    expect(resposta).toHaveProperty("erro");
  });

  describe("com setembro fechado, nenhum caminho mexe no dinheiro dele", () => {
    let setembro: Awaited<ReturnType<typeof comSetembro>>;
    let rafael: string;
    let pagamentoId: string;
    let vencimentoPagoId: string;

    beforeEach(async () => {
      const db = await banco();
      setembro = await comSetembro(estudio);
      rafael = await colaborador(estudio.usuario.id);

      const pago = await registrarPagamento(db, estudio.usuario.id, {
        colaboradorId: rafael,
        tipo: "salario",
        competencia: SETEMBRO,
        valorCentavos: 190000,
        pagoEm: "2026-09-05",
      });
      if ("erro" in pago) throw new Error(pago.erro);
      pagamentoId = pago.id;

      const conta = await db.vencimento.create({
        data: { usuarioId: estudio.usuario.id, descricao: "Aluguel", valorCentavos: 180000, data: dia("2026-09-05") },
      });
      const pagoVenc = await pagarVencimento(db, estudio.usuario.id, conta.id, dia("2026-09-05"));
      expect(pagoVenc).toEqual({ resultado: "pago", tipo: "conta" });
      vencimentoPagoId = conta.id;

      const fechado = await fecharMes(db, estudio.usuario.id, SETEMBRO, AGORA);
      expect(fechado).toHaveProperty("resultado", "fechado");
    });

    async function totalDeSetembro() {
      const db = await banco();
      const relatorio = await relatorioAoVivo(db, estudio.usuario.id, SETEMBRO, AGORA);
      return {
        entradas: relatorio.entradas.totalCentavos,
        saidas: relatorio.saidas.totalCentavos,
        aReceber: relatorio.cobrancas.atrasadas.totalCentavos + relatorio.cobrancas.emAberto.totalCentavos,
        contasPagas: relatorio.contasAPagar.pagas.totalCentavos,
      };
    }

    it("lançamento das Finanças: criar e apagar", async () => {
      const db = await banco();
      const antes = await totalDeSetembro();

      const criado = await registrarLancamento(db, estudio.usuario.id, {
        tipo: "saida",
        descricao: "Produto",
        categoria: null,
        valorCentavos: 1000,
        data: deDataLocal("2026-09-30")!,
      });
      expect(criado).toEqual({ erro: MES_FECHADO });
      expect(await apagarLancamento(db, estudio.usuario.id, setembro.saida.id)).toEqual({ erro: MES_FECHADO });
      // 30/09 às 23h30 em São Paulo ainda é setembro, mesmo já sendo outubro em UTC.
      expect(
        await registrarLancamento(db, estudio.usuario.id, {
          tipo: "entrada",
          descricao: "Extra",
          categoria: null,
          valorCentavos: 1000,
          data: new Date("2026-10-01T02:30:00Z"),
        }),
      ).toEqual({ erro: MES_FECHADO });

      expect(await totalDeSetembro()).toEqual(antes);
    });

    it("pagamento da Equipe: registrar e apagar", async () => {
      const db = await banco();
      const antes = await totalDeSetembro();

      const novo = await registrarPagamento(db, estudio.usuario.id, {
        colaboradorId: rafael,
        tipo: "bonus",
        competencia: SETEMBRO,
        valorCentavos: 10000,
        pagoEm: "2026-09-30",
      });
      expect(novo).toEqual({ erro: MES_FECHADO });
      expect(await excluirPagamento(db, estudio.usuario.id, pagamentoId)).toEqual({
        erro: MES_FECHADO,
        competencia: SETEMBRO,
      });
      expect(await db.pagamentoDeColaborador.count({ where: { id: pagamentoId } })).toBe(1);

      expect(await totalDeSetembro()).toEqual(antes);
    });

    it("vencimento: pagar e apagar o que já foi pago", async () => {
      const db = await banco();
      const antes = await totalDeSetembro();

      expect(await pagarVencimento(db, estudio.usuario.id, setembro.conta.id, dia("2026-09-25"))).toEqual({
        erro: MES_FECHADO,
      });
      expect(await apagarVencimento(db, estudio.usuario.id, vencimentoPagoId)).toEqual({ erro: MES_FECHADO });
      const conta = await db.vencimento.findUniqueOrThrow({ where: { id: setembro.conta.id } });
      expect(conta.pago).toBe(false);

      expect(await totalDeSetembro()).toEqual(antes);
    });

    it("cobrança: marcar como paga, avulsa ou da agenda", async () => {
      const db = await banco();
      const antes = await totalDeSetembro();

      expect(
        await receberCobranca(db, estudio.usuario.id, { id: setembro.avulsa.id, forma: "pix", pagaEm: dia("2026-09-28") }),
      ).toEqual({ erro: MES_FECHADO });
      // A cobrança que veio da agenda também não muda o "a receber" do mês fechado.
      expect(
        await receberCobranca(db, estudio.usuario.id, {
          id: estudio.cobranca.id,
          forma: "dinheiro",
          pagaEm: dia("2026-09-30"),
        }),
      ).toEqual({ erro: MES_FECHADO });
      const avulsa = await db.cobranca.findUniqueOrThrow({ where: { id: setembro.avulsa.id } });
      expect(avulsa.situacao).toBe("aberta");

      expect(await totalDeSetembro()).toEqual(antes);
    });

    it("agenda: concluir, desfazer a conclusão e apagar um concluído", async () => {
      const db = await banco();
      const antes = await totalDeSetembro();

      const agendadoEmSetembro = await db.agendamento.create({
        data: {
          usuarioId: estudio.usuario.id,
          clienteId: estudio.cliente.id,
          servicoId: estudio.servico.id,
          inicio: sp("2026-09-29T10:00:00"),
        },
      });
      const concluir = await mudarStatusDoHorario(db, estudio.usuario.id, {
        id: agendadoEmSetembro.id,
        status: "concluido",
        cancelarCobranca: false,
      });
      expect(concluir).toMatchObject({ erro: MES_FECHADO });

      const desfazer = await mudarStatusDoHorario(db, estudio.usuario.id, {
        id: setembro.atendimento.id,
        status: "agendado",
        cancelarCobranca: false,
      });
      expect(desfazer).toMatchObject({ erro: MES_FECHADO });
      expect(await apagarHorario(db, estudio.usuario.id, setembro.atendimento.id)).toMatchObject({
        erro: MES_FECHADO,
      });

      // Cancelar um horário que nunca foi concluído não é dinheiro: segue livre.
      expect(
        await mudarStatusDoHorario(db, estudio.usuario.id, {
          id: agendadoEmSetembro.id,
          status: "cancelado",
          cancelarCobranca: false,
        }),
      ).toMatchObject({ resultado: "feito" });

      expect(await totalDeSetembro()).toEqual(antes);
    });

    it("cliente com atendimento concluído no mês fechado não é apagado", async () => {
      const db = await banco();
      expect(await apagarCliente(db, estudio.usuario.id, estudio.cliente.id)).toEqual({ erro: MES_FECHADO });
      expect(await db.cliente.count({ where: { id: estudio.cliente.id } })).toBe(1);
    });

    it("classificar custos continua permitido, e os outros meses seguem abertos", async () => {
      const db = await banco();
      expect(await definirNatureza(db, estudio.usuario.id, setembro.saida.id, "variavel")).toBe(true);

      const outubro = await registrarLancamento(db, estudio.usuario.id, {
        tipo: "saida",
        descricao: "Produto",
        categoria: "Material",
        valorCentavos: 1000,
        data: deDataLocal("2026-10-01")!,
      });
      expect(outubro).toHaveProperty("id");
    });

    it("depois de reabrir, o mesmo caminho volta a gravar", async () => {
      const db = await banco();
      await reabrirMes(db, estudio.usuario.id, SETEMBRO, AGORA);
      const criado = await registrarLancamento(db, estudio.usuario.id, {
        tipo: "saida",
        descricao: "Produto",
        categoria: null,
        valorCentavos: 1000,
        data: deDataLocal("2026-09-30")!,
      });
      expect(criado).toHaveProperty("id");
    });
  });

  it("lançar e fechar ao mesmo tempo: o lançamento entra no resumo ou é recusado, nunca fica de fora calado", async () => {
    const db = await banco();
    for (let rodada = 0; rodada < 5; rodada++) {
      await db.fechamentoDoMes.deleteMany();
      const [lancado, fechado] = await Promise.all([
        registrarLancamento(db, estudio.usuario.id, {
          tipo: "entrada",
          descricao: `Rodada ${rodada}`,
          categoria: null,
          valorCentavos: 100,
          data: sp("2026-09-20T10:00:00"),
        }),
        fecharMes(db, estudio.usuario.id, SETEMBRO, AGORA),
      ]);
      if (!("resultado" in fechado) || fechado.resultado !== "fechado") throw new Error("não fechou");
      const noBanco = await db.lancamento.aggregate({
        where: { usuarioId: estudio.usuario.id, tipo: "entrada" },
        _sum: { valorCentavos: true },
      });
      // O resumo guardado sempre bate com o que ficou no banco.
      expect(fechado.relatorio.entradas.manuais.totalCentavos).toBe(noBanco._sum.valorCentavos ?? 0);
      if ("erro" in lancado) expect(lancado.erro).toBe(MES_FECHADO);
    }
  });

  it("isolamento: o mês fechado de um estúdio não trava o outro, e um não vê o dinheiro do outro", async () => {
    const db = await banco();
    await comSetembro(estudio);
    const outro = await montarEstudio("vizinho");
    await db.lancamento.create({
      data: {
        usuarioId: outro.usuario.id,
        tipo: "entrada",
        descricao: "Do vizinho",
        valorCentavos: 777700,
        data: sp("2026-09-12T10:00:00"),
      },
    });

    await fecharMes(db, estudio.usuario.id, SETEMBRO, AGORA);

    const doVizinho = await registrarLancamento(db, outro.usuario.id, {
      tipo: "saida",
      descricao: "Material",
      categoria: null,
      valorCentavos: 500,
      data: sp("2026-09-20T10:00:00"),
    });
    expect(doVizinho).toHaveProperty("id");

    const meu = await relatorioDoMes(db, estudio.usuario.id, SETEMBRO, AGORA);
    expect(meu.relatorio.entradas.manuais.totalCentavos).toBe(5000);
    const dele = await relatorioDoMes(db, outro.usuario.id, SETEMBRO, AGORA);
    expect(dele.congelado).toBe(false);
    expect(dele.relatorio.entradas.manuais.totalCentavos).toBe(777700);

    // Reabrir o mês de outro estúdio pelo id errado não faz nada.
    expect(await reabrirMes(db, outro.usuario.id, SETEMBRO, AGORA)).toEqual({ resultado: "nao_estava_fechado" });
    expect((await relatorioDoMes(db, estudio.usuario.id, SETEMBRO, AGORA)).congelado).toBe(true);

    // Os caminhos de escrita também não alcançam o outro estúdio pelo id.
    const saidaDoVizinho = await db.lancamento.findFirstOrThrow({ where: { usuarioId: outro.usuario.id, tipo: "saida" } });
    expect(await apagarLancamento(db, estudio.usuario.id, saidaDoVizinho.id)).toEqual({ resultado: "nao_encontrado" });
  });

  it("no banco, a cobrança recebida não conta duas vezes", async () => {
    const db = await banco();
    const usuarioId = estudio.usuario.id;
    // O horário da agenda concluído em outubro, e a cobrança dele paga.
    await db.agendamento.update({ where: { id: estudio.agendamento.id }, data: { status: "concluido" } });
    expect(
      await receberCobranca(db, usuarioId, { id: estudio.cobranca.id, forma: "pix", pagaEm: dia("2026-10-06") }),
    ).toEqual({ resultado: "paga" });
    // Uma cobrança avulsa paga em outubro.
    const avulsa = await db.cobranca.create({
      data: { usuarioId, clienteId: estudio.cliente.id, valorCentavos: 7000, vencimento: dia("2026-10-10") },
    });
    expect(await receberCobranca(db, usuarioId, { id: avulsa.id, forma: "pix", pagaEm: dia("2026-10-10") })).toEqual({
      resultado: "paga",
    });

    const relatorio = await relatorioAoVivo(db, usuarioId, "2026-10", AGORA);
    expect(relatorio.entradas.atendimentos.totalCentavos).toBe(12000);
    expect(relatorio.entradas.cobrancasRecebidas.totalCentavos).toBe(7000);
    expect(relatorio.entradas.manuais.totalCentavos).toBe(0);
    expect(relatorio.entradas.totalCentavos).toBe(19000);
    expect(relatorio.cobrancas.emAberto.quantidade + relatorio.cobrancas.atrasadas.quantidade).toBe(0);
  });
});
