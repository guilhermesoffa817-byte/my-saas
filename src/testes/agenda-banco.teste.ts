import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";
import { remarcarHorarioNoBanco } from "@/lib/agenda-operacoes";

/**
 * Remarcar um horário na agenda, no banco de verdade: muda dia, hora, serviço
 * e quem atende com a mesma conferência de choque de quem marca, e não perde
 * nada do que o horário já tinha (cliente, observação, marca do link).
 */

const sp = (texto: string) => new Date(`${texto}:00-03:00`);

type Estudio = Awaited<ReturnType<typeof montarEstudio>>;

/** Um horário agendado, sem cobrança, com observação e vindo do link. */
async function horarioDoLink(estudio: Estudio, inicio: string, extra: { colaboradorId?: string } = {}) {
  const db = await banco();
  return db.agendamento.create({
    data: {
      usuarioId: estudio.usuario.id,
      clienteId: estudio.cliente.id,
      servicoId: estudio.servico.id,
      inicio: sp(inicio),
      origem: "link",
      observacoes: "Marcado pelo link · vai trazer a irmã",
      ...extra,
    },
  });
}

async function outroServico(estudio: Estudio, nome: string, duracaoMin: number) {
  const db = await banco();
  return db.servico.create({
    data: { usuarioId: estudio.usuario.id, nome, precoCentavos: 8000, duracaoMin },
  });
}

describe.skipIf(!TEM_BANCO)("remarcar horário", () => {
  beforeEach(async () => {
    await limpar();
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("muda dia, hora e serviço e guarda cliente, observação e a marca do link", async () => {
    const db = await banco();
    const estudio = await montarEstudio("remarca");
    const horario = await horarioDoLink(estudio, "2026-10-20T10:00");
    const escova = await outroServico(estudio, "Escova", 45);

    const feito = await remarcarHorarioNoBanco(db, estudio.usuario.id, {
      id: horario.id,
      inicio: sp("2026-10-22T15:30"),
      servicoId: escova.id,
    });
    expect(feito).toEqual({ ok: true, inicio: sp("2026-10-22T15:30"), mudou: true });

    const depois = await db.agendamento.findUniqueOrThrow({ where: { id: horario.id } });
    expect(depois.inicio).toEqual(sp("2026-10-22T15:30"));
    expect(depois.servicoId).toBe(escova.id);
    expect(depois.clienteId).toBe(estudio.cliente.id);
    expect(depois.observacoes).toBe("Marcado pelo link · vai trazer a irmã");
    expect(depois.origem).toBe("link");
    expect(depois.status).toBe("agendado");
    // Continua um horário só: remarcar não cria outro.
    expect(await db.agendamento.count({ where: { usuarioId: estudio.usuario.id } })).toBe(2);
  });

  it("não remarca por cima de outro atendimento, e não esbarra nele mesmo", async () => {
    const db = await banco();
    const estudio = await montarEstudio("choque");
    const horario = await horarioDoLink(estudio, "2026-10-20T10:00");
    await horarioDoLink(estudio, "2026-10-20T14:00");

    // 13:30 com 60 min esbarra no das 14:00.
    const recusado = await remarcarHorarioNoBanco(db, estudio.usuario.id, {
      id: horario.id,
      inicio: sp("2026-10-20T13:30"),
      servicoId: estudio.servico.id,
    });
    expect(recusado).toMatchObject({ erro: expect.stringContaining("esbarra no atendimento de") });
    expect((await db.agendamento.findUniqueOrThrow({ where: { id: horario.id } })).inicio).toEqual(
      sp("2026-10-20T10:00"),
    );

    // 10:30 sobrepõe o próprio horário das 10:00: isso pode.
    const meiaHora = await remarcarHorarioNoBanco(db, estudio.usuario.id, {
      id: horario.id,
      inicio: sp("2026-10-20T10:30"),
      servicoId: estudio.servico.id,
    });
    expect(meiaHora).toMatchObject({ ok: true, mudou: true });
  });

  it("com equipe, o choque é só com a agenda da mesma pessoa; sem campo, fica quem atendia", async () => {
    const db = await banco();
    const estudio = await montarEstudio("equipe");
    const paula = await db.colaborador.create({
      data: {
        usuarioId: estudio.usuario.id,
        nome: "Paula Ribeiro",
        vinculo: "parceria",
        inicio: new Date("2026-01-01T00:00:00.000Z"),
      },
    });
    const daPaula = await horarioDoLink(estudio, "2026-10-20T10:00", { colaboradorId: paula.id });
    // A dona tem atendimento às 14:00; a Paula está livre.
    await horarioDoLink(estudio, "2026-10-20T14:00");

    const paraPaula = await remarcarHorarioNoBanco(db, estudio.usuario.id, {
      id: daPaula.id,
      inicio: sp("2026-10-20T14:00"),
      servicoId: estudio.servico.id,
    });
    expect(paraPaula).toMatchObject({ ok: true });
    const depois = await db.agendamento.findUniqueOrThrow({ where: { id: daPaula.id } });
    expect(depois.colaboradorId).toBe(paula.id);

    // Passar para a dona às 14:00 esbarra no horário dela.
    const paraDona = await remarcarHorarioNoBanco(db, estudio.usuario.id, {
      id: daPaula.id,
      inicio: sp("2026-10-20T14:00"),
      servicoId: estudio.servico.id,
      colaboradorId: null,
    });
    expect(paraDona).toMatchObject({ erro: expect.stringContaining("esbarra") });
  });

  it("concluído e cancelado não se remarcam", async () => {
    const db = await banco();
    const estudio = await montarEstudio("situacao");
    const concluido = await horarioDoLink(estudio, "2026-10-20T10:00");
    await db.agendamento.update({ where: { id: concluido.id }, data: { status: "concluido" } });
    const cancelado = await horarioDoLink(estudio, "2026-10-20T15:00");
    await db.agendamento.update({ where: { id: cancelado.id }, data: { status: "cancelado" } });

    for (const id of [concluido.id, cancelado.id]) {
      const resposta = await remarcarHorarioNoBanco(db, estudio.usuario.id, {
        id,
        inicio: sp("2026-10-23T09:00"),
        servicoId: estudio.servico.id,
      });
      expect(resposta).toMatchObject({ erro: expect.stringMatching(/volte para agendado/i) });
    }
    expect((await db.agendamento.findUniqueOrThrow({ where: { id: concluido.id } })).inicio).toEqual(
      sp("2026-10-20T10:00"),
    );
  });

  it("com cobrança, muda a hora mas não o serviço", async () => {
    const db = await banco();
    const estudio = await montarEstudio("cobranca");
    // O horário do montarEstudio tem cobrança aberta de R$ 120,00.
    const escova = await outroServico(estudio, "Escova", 45);

    const trocaServico = await remarcarHorarioNoBanco(db, estudio.usuario.id, {
      id: estudio.agendamento.id,
      inicio: estudio.agendamento.inicio,
      servicoId: escova.id,
    });
    expect(trocaServico).toMatchObject({ erro: expect.stringContaining("120,00") });

    const trocaHora = await remarcarHorarioNoBanco(db, estudio.usuario.id, {
      id: estudio.agendamento.id,
      inicio: sp("2026-10-06T16:00"),
      servicoId: estudio.servico.id,
    });
    expect(trocaHora).toMatchObject({ ok: true, mudou: true });
  });

  it("nunca mexe no horário de outro estúdio, nem com serviço de outro estúdio", async () => {
    const db = await banco();
    const ana = await montarEstudio("ana");
    const bia = await montarEstudio("bia");
    const daBia = await horarioDoLink(bia, "2026-10-20T10:00");
    const daAna = await horarioDoLink(ana, "2026-10-20T10:00");

    const alheio = await remarcarHorarioNoBanco(db, ana.usuario.id, {
      id: daBia.id,
      inicio: sp("2026-10-21T10:00"),
      servicoId: ana.servico.id,
    });
    expect(alheio).toEqual({ erro: "Não encontramos esse horário na sua agenda." });

    const servicoAlheio = await remarcarHorarioNoBanco(db, ana.usuario.id, {
      id: daAna.id,
      inicio: sp("2026-10-21T10:00"),
      servicoId: bia.servico.id,
    });
    expect(servicoAlheio).toEqual({ erro: "Não encontramos esse serviço na sua lista." });

    expect((await db.agendamento.findUniqueOrThrow({ where: { id: daBia.id } })).inicio).toEqual(
      sp("2026-10-20T10:00"),
    );
  });
});
