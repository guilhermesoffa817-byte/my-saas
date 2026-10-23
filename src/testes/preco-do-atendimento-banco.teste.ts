import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";
import { receberCobranca } from "@/lib/cobranca-operacoes";
import { carregarDadosDoMes } from "@/lib/relatorio/operacoes";
import { carregarMovimento } from "@/lib/custos/operacoes";
import { fecharMes } from "@/lib/fechamento/operacoes";
import { precoDoAtendimento } from "@/lib/preco-do-atendimento";

/**
 * O preço de cada atendimento fica guardado nele.
 *
 * O erro antigo: mudar o preço do serviço de R$ 1.234,56 para R$ 1.300,00
 * mudava o faturamento de atendimentos já concluídos, no mês corrente, no
 * gráfico, em Custos, no Relatório e na base da comissão. E uma cobrança da
 * agenda recebida com outro valor (R$ 40,00 por um serviço de R$ 45,00) nunca
 * chegava às Finanças: o que contava era o preço da tabela.
 */
const dia = (texto: string) => new Date(`${texto}T00:00:00.000Z`);

describe.skipIf(!TEM_BANCO)("preço guardado no atendimento", () => {
  let estudio: Awaited<ReturnType<typeof montarEstudio>>;

  beforeEach(async () => {
    await limpar();
    estudio = await montarEstudio("preco");
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("o horário marcado sem preço recebe o preço do serviço naquele instante", async () => {
    const db = await banco();
    // montarEstudio cria o horário sem mandar preço: quem preenche é o banco.
    const horario = await db.agendamento.findUniqueOrThrow({ where: { id: estudio.agendamento.id } });
    expect(horario.precoCentavos).toBe(12000);
  });

  it("mudar o preço do serviço não muda o que já foi marcado nem o que já entrou", async () => {
    const db = await banco();
    const { usuario, servico, agendamento } = estudio;
    await db.agendamento.update({ where: { id: agendamento.id }, data: { status: "concluido" } });

    await db.servico.update({ where: { id: servico.id }, data: { precoCentavos: 13000 } });

    const horario = await db.agendamento.findUniqueOrThrow({
      where: { id: agendamento.id },
      include: { servico: true },
    });
    expect(horario.precoCentavos).toBe(12000);
    expect(precoDoAtendimento(horario)).toBe(12000);

    // Relatório e Custos leem o preço guardado, não o de hoje.
    const dados = await carregarDadosDoMes(db, usuario.id, "2026-10", new Date("2026-10-20T12:00:00Z"));
    expect(dados.atendimentos.map((item) => item.precoCentavos)).toEqual([12000]);
    const movimento = await carregarMovimento(db, usuario.id, "2026-10");
    expect(movimento.receitas.map((item) => item.valorCentavos)).toEqual([12000]);

    // O próximo horário já sai com o preço novo.
    const novo = await db.agendamento.create({
      data: {
        usuarioId: usuario.id,
        clienteId: estudio.cliente.id,
        servicoId: servico.id,
        inicio: new Date("2026-10-06T12:00:00.000Z"),
      },
    });
    expect(novo.precoCentavos).toBe(13000);
  });

  it("o preço mandado pela tela vale, mesmo diferente do serviço", async () => {
    const db = await banco();
    const horario = await db.agendamento.create({
      data: {
        usuarioId: estudio.usuario.id,
        clienteId: estudio.cliente.id,
        servicoId: estudio.servico.id,
        inicio: new Date("2026-10-07T12:00:00.000Z"),
        precoCentavos: 9900,
      },
    });
    expect(horario.precoCentavos).toBe(9900);
  });

  it("trocar o serviço do horário leva o preço do serviço novo", async () => {
    const db = await banco();
    const outro = await db.servico.create({
      data: { usuarioId: estudio.usuario.id, nome: "Mega hair", precoCentavos: 130000 },
    });
    const trocado = await db.agendamento.update({
      where: { id: estudio.agendamento.id },
      data: { servicoId: outro.id },
    });
    expect(trocado.precoCentavos).toBe(130000);
  });

  it("cobrança do horário recebida com outro valor: vale o valor recebido", async () => {
    const db = await banco();
    const { usuario, agendamento, cobranca } = estudio;
    await db.cobranca.update({ where: { id: cobranca.id }, data: { valorCentavos: 4000 } });
    await db.agendamento.update({ where: { id: agendamento.id }, data: { status: "concluido" } });

    const recebido = await receberCobranca(db, usuario.id, {
      id: cobranca.id,
      forma: "pix",
      pagaEm: dia("2026-10-05"),
    });
    expect(recebido).toEqual({ resultado: "paga" });

    const horario = await db.agendamento.findUniqueOrThrow({ where: { id: agendamento.id } });
    expect(horario.precoCentavos).toBe(4000);
    // E continua sem lançamento à parte: o dinheiro entra uma vez só, pelo atendimento.
    expect(await db.lancamento.count({ where: { usuarioId: usuario.id } })).toBe(0);
    const dados = await carregarDadosDoMes(db, usuario.id, "2026-10", new Date("2026-10-20T12:00:00Z"));
    expect(dados.atendimentos.map((item) => item.precoCentavos)).toEqual([4000]);
  });

  it("vale também para o horário ainda não concluído: ao concluir, entra o valor recebido", async () => {
    const db = await banco();
    const { usuario, agendamento, cobranca } = estudio;
    await db.cobranca.update({ where: { id: cobranca.id }, data: { valorCentavos: 4000 } });

    await receberCobranca(db, usuario.id, { id: cobranca.id, forma: "pix", pagaEm: dia("2026-10-05") });
    await db.agendamento.update({ where: { id: agendamento.id }, data: { status: "concluido" } });

    const dados = await carregarDadosDoMes(db, usuario.id, "2026-10", new Date("2026-10-20T12:00:00Z"));
    expect(dados.atendimentos.map((item) => item.precoCentavos)).toEqual([4000]);
  });

  it("atendimento concluído em mês fechado não muda por trás do resumo congelado", async () => {
    const db = await banco();
    const { usuario, cliente, servico } = estudio;
    const setembro = await db.agendamento.create({
      data: {
        usuarioId: usuario.id,
        clienteId: cliente.id,
        servicoId: servico.id,
        inicio: new Date("2026-09-20T15:00:00.000Z"),
        status: "concluido",
      },
    });
    const cobranca = await db.cobranca.create({
      data: {
        usuarioId: usuario.id,
        clienteId: cliente.id,
        agendamentoId: setembro.id,
        valorCentavos: 10000,
        vencimento: dia("2026-09-20"),
      },
    });
    await fecharMes(db, usuario.id, "2026-09", new Date("2026-10-02T12:00:00Z"));

    // Pago em outubro, que está aberto: o recebimento vale.
    const recebido = await receberCobranca(db, usuario.id, {
      id: cobranca.id,
      forma: "pix",
      pagaEm: dia("2026-10-03"),
    });
    expect(recebido).toEqual({ resultado: "paga" });

    const horario = await db.agendamento.findUniqueOrThrow({ where: { id: setembro.id } });
    expect(horario.precoCentavos).toBe(12000);
  });

  it("o recebimento de outro estúdio não mexe no horário de ninguém", async () => {
    const db = await banco();
    const outro = await montarEstudio("outro");
    await db.cobranca.update({ where: { id: estudio.cobranca.id }, data: { valorCentavos: 4000 } });

    const resultado = await receberCobranca(db, outro.usuario.id, {
      id: estudio.cobranca.id,
      forma: "pix",
      pagaEm: dia("2026-10-05"),
    });
    expect(resultado).toEqual({ erro: "Não encontramos essa cobrança." });
    const horario = await db.agendamento.findUniqueOrThrow({ where: { id: estudio.agendamento.id } });
    expect(horario.precoCentavos).toBe(12000);
  });
});
