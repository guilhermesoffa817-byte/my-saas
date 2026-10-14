import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";
import {
  atendimentosDoGrafico,
  movimentoDoMes,
  primeiroMesComMovimento,
} from "@/lib/financas-consultas";
import { resumoDoMes } from "@/lib/financas";

/**
 * O dinheiro da aba Finanças, com as consultas de verdade.
 *
 * O que não pode acontecer aqui: o mês de um estúdio somar o dinheiro de
 * outro, o atendimento das 22h do último dia cair no mês seguinte, a despesa
 * paga no dia 1º ir para o mês passado, e o faturamento antigo mudar quando o
 * preço do serviço sobe.
 */
describe.skipIf(!TEM_BANCO)("finanças no banco", () => {
  let um: Awaited<ReturnType<typeof montarEstudio>>;
  let outro: Awaited<ReturnType<typeof montarEstudio>>;

  beforeEach(async () => {
    await limpar();
    um = await montarEstudio("financas-um");
    outro = await montarEstudio("financas-outro");
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  async function atendimento(
    estudio: typeof um,
    inicio: string,
    status: string,
    valorCentavos: number | null,
  ) {
    const db = await banco();
    return db.agendamento.create({
      data: {
        usuarioId: estudio.usuario.id,
        clienteId: estudio.cliente.id,
        servicoId: estudio.servico.id,
        inicio: new Date(inicio),
        status,
        valorCentavos,
      },
    });
  }

  async function lancamento(
    estudio: typeof um,
    data: string,
    tipo: "entrada" | "saida",
    valorCentavos: number,
    descricao = "Lançamento",
  ) {
    const db = await banco();
    return db.lancamento.create({
      data: {
        usuarioId: estudio.usuario.id,
        tipo,
        descricao,
        valorCentavos,
        data: new Date(data),
      },
    });
  }

  it("soma o mês de São Paulo, com o valor combinado em cada atendimento", async () => {
    const db = await banco();

    // O serviço custa 120,00, mas este horário foi combinado por 90,00.
    await atendimento(um, "2026-10-10T13:00:00.000Z", "concluido", 9000);
    // Horário antigo, de antes do valor guardado: vale o preço do serviço.
    await atendimento(um, "2026-10-11T13:00:00.000Z", "concluido", null);
    // 31 de outubro às 22h em São Paulo, já 1º de novembro em Greenwich.
    await atendimento(um, "2026-11-01T01:00:00.000Z", "concluido", 5000);
    // 30 de setembro às 23h30 em São Paulo: é de setembro.
    await atendimento(um, "2026-10-01T02:30:00.000Z", "concluido", 7000);
    // Falta e cancelamento não são dinheiro.
    await atendimento(um, "2026-10-12T13:00:00.000Z", "faltou", 9000);
    await atendimento(um, "2026-10-13T13:00:00.000Z", "cancelado", 9000);

    // Subir o preço do serviço depois não muda o que já foi combinado.
    await db.servico.update({ where: { id: um.servico.id }, data: { precoCentavos: 20000 } });

    const outubro = await movimentoDoMes(db, um.usuario.id, "2026-10");
    const resumo = resumoDoMes({ ...outubro, impostoPercentual: 0 });
    expect(outubro.atendimentos).toHaveLength(3);
    expect(resumo.atendimentosCentavos).toBe(9000 + 20000 + 5000);

    const setembro = await movimentoDoMes(db, um.usuario.id, "2026-09");
    expect(resumoDoMes({ ...setembro, impostoPercentual: 0 }).atendimentosCentavos).toBe(7000);
  });

  it("põe cada lançamento no mês do dia dele, venha de onde vier", async () => {
    const db = await banco();

    // Pagamento de cobrança ou de vencimento: data pura, meia-noite de Greenwich.
    const puraDoDia1 = await lancamento(um, "2026-10-01T00:00:00.000Z", "saida", 1000);
    // Formulário das Finanças: meia-noite de São Paulo.
    const localDoUltimoDia = await lancamento(um, "2026-10-31T03:00:00.000Z", "saida", 2000);
    const puraDeNovembro = await lancamento(um, "2026-11-01T00:00:00.000Z", "saida", 4000);
    const localDeNovembro = await lancamento(um, "2026-11-01T03:00:00.000Z", "entrada", 8000);
    const localDeSetembro = await lancamento(um, "2026-09-30T03:00:00.000Z", "saida", 16000);

    const outubro = await movimentoDoMes(db, um.usuario.id, "2026-10");
    expect(outubro.lancamentos.map((item) => item.id).sort()).toEqual(
      [puraDoDia1.id, localDoUltimoDia.id].sort(),
    );
    // O dia mostrado é o de calendário, sem escorregar para o dia anterior.
    expect(outubro.lancamentos.map((item) => item.dia)).toEqual(["2026-10-31", "2026-10-01"]);

    const novembro = await movimentoDoMes(db, um.usuario.id, "2026-11");
    expect(novembro.lancamentos.map((item) => item.id).sort()).toEqual(
      [puraDeNovembro.id, localDeNovembro.id].sort(),
    );

    const setembro = await movimentoDoMes(db, um.usuario.id, "2026-09");
    expect(setembro.lancamentos.map((item) => item.id)).toEqual([localDeSetembro.id]);
  });

  it("um estúdio nunca soma o dinheiro do outro", async () => {
    const db = await banco();

    await atendimento(um, "2026-10-10T13:00:00.000Z", "concluido", 9000);
    await lancamento(um, "2026-10-05T03:00:00.000Z", "saida", 1000, "Material");
    await atendimento(outro, "2026-10-10T13:00:00.000Z", "concluido", 999900);
    await lancamento(outro, "2026-10-05T03:00:00.000Z", "entrada", 777700, "Do outro");

    const doUm = await movimentoDoMes(db, um.usuario.id, "2026-10");
    const resumo = resumoDoMes({ ...doUm, impostoPercentual: 0 });
    expect(resumo.atendimentosCentavos).toBe(9000);
    expect(resumo.entradasManuais).toBe(0);
    expect(doUm.lancamentos.map((item) => item.descricao)).toEqual(["Material"]);

    const grafico = await atendimentosDoGrafico(
      db,
      um.usuario.id,
      new Date("2026-10-14T15:00:00.000Z"),
    );
    expect(grafico).toHaveLength(1);
    expect(grafico[0].valorCentavos).toBe(9000);
  });

  it("o gráfico olha os últimos noventa dias, até o fim de hoje", async () => {
    const db = await banco();
    const agora = new Date("2026-10-14T15:00:00.000Z");

    await atendimento(um, "2026-10-14T22:00:00.000Z", "concluido", 1000); // hoje, 19h
    await atendimento(um, "2026-07-20T13:00:00.000Z", "concluido", 2000); // dentro
    await atendimento(um, "2026-07-01T13:00:00.000Z", "concluido", 4000); // antes
    await atendimento(um, "2026-10-20T13:00:00.000Z", "concluido", 8000); // futuro

    const grafico = await atendimentosDoGrafico(db, um.usuario.id, agora);
    expect(grafico.map((item) => item.valorCentavos).sort()).toEqual([1000, 2000]);
  });

  it("o primeiro mês é o da conta, ou o do lançamento mais antigo", async () => {
    const db = await banco();
    const criadoEm = new Date("2026-03-10T12:00:00.000Z");
    await db.usuario.update({ where: { id: um.usuario.id }, data: { criadoEm } });

    expect(await primeiroMesComMovimento(db, { id: um.usuario.id, criadoEm })).toBe("2026-03");

    // Data pura de 1º de dezembro: é dezembro, mesmo sendo 21h de novembro em São Paulo.
    await lancamento(um, "2025-12-01T00:00:00.000Z", "saida", 1000);
    // O lançamento antigo do outro estúdio não conta.
    await lancamento(outro, "2024-01-15T03:00:00.000Z", "saida", 1000);

    expect(await primeiroMesComMovimento(db, { id: um.usuario.id, criadoEm })).toBe("2025-12");
  });
});
