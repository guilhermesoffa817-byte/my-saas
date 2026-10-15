import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";
import { devolverClienteParaLista, tirarClienteDaLista } from "@/lib/historico";
import { valorDoAtendimento } from "@/lib/atendimento";
import { inicioDoMes, inicioDoProximoMes } from "@/lib/formato";

/**
 * Arquivar em vez de apagar.
 *
 * Apagar uma cliente levava junto, em cascata, os horários e as cobranças
 * dela, inclusive as pagas, e o faturamento dos meses passados encolhia sem
 * ninguém perceber. Estes testes rodam a mesma função que a ação usa, contra
 * um banco de verdade, e exigem que o dinheiro que já entrou continue lá.
 */

const AGORA = new Date("2026-10-15T12:00:00.000Z");

describe.skipIf(!TEM_BANCO)("tirar a cliente da lista", () => {
  let estudio: Awaited<ReturnType<typeof montarEstudio>>;

  beforeEach(async () => {
    await limpar();
    estudio = await montarEstudio("arquivo");
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  /** Um horário da cliente do estúdio, com a situação e a data pedidas. */
  async function horario(inicio: string, status: string) {
    const db = await banco();
    return db.agendamento.create({
      data: {
        usuarioId: estudio.usuario.id,
        clienteId: estudio.cliente.id,
        servicoId: estudio.servico.id,
        inicio: new Date(inicio),
        status,
        valorCentavos: 15000,
      },
    });
  }

  it("arquiva quem tem histórico e guarda as cobranças pagas e os atendimentos concluídos", async () => {
    const db = await banco();

    const concluido = await horario("2026-09-10T12:00:00.000Z", "concluido");
    const paga = await db.cobranca.create({
      data: {
        usuarioId: estudio.usuario.id,
        clienteId: estudio.cliente.id,
        agendamentoId: concluido.id,
        valorCentavos: 15000,
        vencimento: new Date("2026-09-10T00:00:00.000Z"),
        situacao: "paga",
        pagaEm: new Date("2026-09-10T00:00:00.000Z"),
      },
    });

    const resultado = await tirarClienteDaLista(db, {
      usuarioId: estudio.usuario.id,
      clienteId: estudio.cliente.id,
      agora: AGORA,
    });
    expect(resultado.feito).toBe("arquivada");

    const cliente = await db.cliente.findUnique({ where: { id: estudio.cliente.id } });
    expect(cliente?.arquivadoEm?.toISOString()).toBe(AGORA.toISOString());

    // O que já aconteceu continua exatamente como estava.
    const atendimento = await db.agendamento.findUnique({ where: { id: concluido.id } });
    expect(atendimento?.status).toBe("concluido");
    expect(atendimento?.valorCentavos).toBe(15000);

    const cobranca = await db.cobranca.findUnique({ where: { id: paga.id } });
    expect(cobranca?.situacao).toBe("paga");

    // E a cobrança em aberto segue devida: arquivar não perdoa dívida.
    const aberta = await db.cobranca.findUnique({ where: { id: estudio.cobranca.id } });
    expect(aberta?.situacao).toBe("aberta");

    // O faturamento de setembro, somado sem olhar para a ficha, não muda.
    const setembro = concluido.inicio;
    const doMes = await db.agendamento.findMany({
      where: {
        usuarioId: estudio.usuario.id,
        status: "concluido",
        inicio: { gte: inicioDoMes(setembro), lt: inicioDoProximoMes(setembro) },
      },
      select: { valorCentavos: true, servico: { select: { precoCentavos: true } } },
    });
    expect(doMes.reduce((soma, item) => soma + valorDoAtendimento(item), 0)).toBe(15000);
  });

  it("cancela os horários marcados dali para a frente, na mesma tacada", async () => {
    const db = await banco();

    const amanha = await horario("2026-10-16T12:00:00.000Z", "agendado");
    const semanaQueVem = await horario("2026-10-22T12:00:00.000Z", "agendado");
    const concluidoOntem = await horario("2026-10-14T12:00:00.000Z", "concluido");
    const faltou = await horario("2026-10-13T12:00:00.000Z", "faltou");

    const resultado = await tirarClienteDaLista(db, {
      usuarioId: estudio.usuario.id,
      clienteId: estudio.cliente.id,
      agora: AGORA,
    });
    expect(resultado).toEqual({ feito: "arquivada", horariosCancelados: 2 });

    const situacao = async (id: string) =>
      (await db.agendamento.findUniqueOrThrow({ where: { id } })).status;

    expect(await situacao(amanha.id)).toBe("cancelado");
    expect(await situacao(semanaQueVem.id)).toBe("cancelado");
    // O passado não se mexe: concluído, falta e o horário de 05/10 que ainda
    // espera a dona dizer se ela veio.
    expect(await situacao(concluidoOntem.id)).toBe("concluido");
    expect(await situacao(faltou.id)).toBe("faltou");
    expect(await situacao(estudio.agendamento.id)).toBe("agendado");
  });

  it("apaga de vez só quem não tem atendimento nem cobrança", async () => {
    const db = await banco();

    const nova = await db.cliente.create({
      data: { usuarioId: estudio.usuario.id, nome: "Recém-chegada", telefone: "66999990000" },
    });

    const resultado = await tirarClienteDaLista(db, {
      usuarioId: estudio.usuario.id,
      clienteId: nova.id,
      agora: AGORA,
    });
    expect(resultado.feito).toBe("apagada");
    expect(await db.cliente.findUnique({ where: { id: nova.id } })).toBeNull();
  });

  it("cobrança sozinha já é histórico: a ficha é arquivada, não apagada", async () => {
    const db = await banco();

    const soCobranca = await db.cliente.create({
      data: { usuarioId: estudio.usuario.id, nome: "Só cobrança", telefone: "66999990001" },
    });
    await db.cobranca.create({
      data: {
        usuarioId: estudio.usuario.id,
        clienteId: soCobranca.id,
        valorCentavos: 8000,
        vencimento: new Date("2026-10-01T00:00:00.000Z"),
        situacao: "paga",
      },
    });

    const resultado = await tirarClienteDaLista(db, {
      usuarioId: estudio.usuario.id,
      clienteId: soCobranca.id,
      agora: AGORA,
    });
    expect(resultado.feito).toBe("arquivada");
    expect(await db.cobranca.count({ where: { clienteId: soCobranca.id } })).toBe(1);
  });

  it("a arquivada some da lista e dos seletores, e volta ao desarquivar", async () => {
    const db = await banco();

    await tirarClienteDaLista(db, {
      usuarioId: estudio.usuario.id,
      clienteId: estudio.cliente.id,
      agora: AGORA,
    });

    // A mesma consulta da lista de clientes e do seletor da nova cobrança.
    const naLista = () =>
      db.cliente.findMany({
        where: { usuarioId: estudio.usuario.id, arquivadoEm: null },
        select: { id: true },
      });

    expect(await naLista()).toEqual([]);

    // Arquivar de novo não muda a data do primeiro arquivamento.
    const deNovo = await tirarClienteDaLista(db, {
      usuarioId: estudio.usuario.id,
      clienteId: estudio.cliente.id,
      agora: new Date("2026-11-01T12:00:00.000Z"),
    });
    expect(deNovo.feito).toBe("nada");

    expect(
      await devolverClienteParaLista(db, {
        usuarioId: estudio.usuario.id,
        clienteId: estudio.cliente.id,
      }),
    ).toBe(true);
    expect(await naLista()).toEqual([{ id: estudio.cliente.id }]);
  });
});

describe.skipIf(!TEM_BANCO)("a ficha de um estúdio não é do outro", () => {
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

  it("não arquiva nem apaga a cliente do outro estúdio", async () => {
    const db = await banco();

    const resultado = await tirarClienteDaLista(db, {
      usuarioId: um.usuario.id,
      clienteId: outro.cliente.id,
      agora: AGORA,
    });
    expect(resultado.feito).toBe("nada");

    const intacta = await db.cliente.findUnique({ where: { id: outro.cliente.id } });
    expect(intacta?.arquivadoEm).toBeNull();

    // Nem os horários futuros dela são cancelados pelo vizinho.
    const futuro = await db.agendamento.create({
      data: {
        usuarioId: outro.usuario.id,
        clienteId: outro.cliente.id,
        servicoId: outro.servico.id,
        inicio: new Date("2026-10-20T12:00:00.000Z"),
      },
    });
    await tirarClienteDaLista(db, {
      usuarioId: um.usuario.id,
      clienteId: outro.cliente.id,
      agora: AGORA,
    });
    expect((await db.agendamento.findUniqueOrThrow({ where: { id: futuro.id } })).status).toBe(
      "agendado",
    );
  });

  it("não apaga a cliente sem histórico do outro estúdio", async () => {
    const db = await banco();

    const semHistorico = await db.cliente.create({
      data: { usuarioId: outro.usuario.id, nome: "Nova do outro", telefone: "66999990002" },
    });

    const resultado = await tirarClienteDaLista(db, {
      usuarioId: um.usuario.id,
      clienteId: semHistorico.id,
      agora: AGORA,
    });
    expect(resultado.feito).toBe("nada");
    expect(await db.cliente.findUnique({ where: { id: semHistorico.id } })).not.toBeNull();
  });

  it("não desarquiva a cliente do outro estúdio", async () => {
    const db = await banco();

    await tirarClienteDaLista(db, {
      usuarioId: outro.usuario.id,
      clienteId: outro.cliente.id,
      agora: AGORA,
    });

    expect(
      await devolverClienteParaLista(db, {
        usuarioId: um.usuario.id,
        clienteId: outro.cliente.id,
      }),
    ).toBe(false);

    const continua = await db.cliente.findUnique({ where: { id: outro.cliente.id } });
    expect(continua?.arquivadoEm).not.toBeNull();
  });

  it("não abre a ficha da cliente do outro estúdio, arquivada ou não", async () => {
    const db = await banco();

    // A consulta da ficha /painel/clientes/[id], com o estúdio errado.
    const ficha = (usuarioId: string) =>
      db.cliente.findFirst({ where: { id: outro.cliente.id, usuarioId } });

    expect(await ficha(um.usuario.id)).toBeNull();
    expect((await ficha(outro.usuario.id))?.id).toBe(outro.cliente.id);

    await tirarClienteDaLista(db, {
      usuarioId: outro.usuario.id,
      clienteId: outro.cliente.id,
      agora: AGORA,
    });
    expect(await ficha(um.usuario.id)).toBeNull();

    // E os atendimentos dela também não aparecem na ficha de quem não é dona.
    const atendimentos = await db.agendamento.findMany({
      where: { clienteId: outro.cliente.id, usuarioId: um.usuario.id },
    });
    expect(atendimentos).toEqual([]);
  });
});
