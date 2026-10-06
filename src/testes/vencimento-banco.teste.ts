import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { TEM_BANCO, banco, limpar, montarEstudio } from "./banco";
import { ocorrenciasQueFaltam } from "@/lib/vencimento";
import { deDataPura, paraDataPura } from "@/lib/formato";

const dia = (texto: string) => deDataPura(texto)!;

describe.skipIf(!TEM_BANCO)("vencimentos no banco", () => {
  let estudio: Awaited<ReturnType<typeof montarEstudio>>;

  beforeEach(async () => {
    await limpar();
    estudio = await montarEstudio("vencimento");
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  it("completar a repetição duas vezes não cria datas repetidas", async () => {
    const db = await banco();
    const hoje = dia("2026-10-05");

    const repeticao = await db.repeticaoDeVencimento.create({
      data: {
        usuarioId: estudio.usuario.id,
        descricao: "Aluguel",
        valorCentavos: 80000,
        primeira: dia("2026-10-30"),
      },
    });

    // Duas passadas seguidas, como duas visitas à tela.
    for (let vez = 0; vez < 2; vez++) {
      const jaGravadas = await db.vencimento.findMany({
        where: { repeticaoId: repeticao.id },
        select: { data: true },
      });
      const faltam = ocorrenciasQueFaltam({
        primeira: repeticao.primeira,
        ate: repeticao.ate,
        jaGravadas: jaGravadas.map((item) => item.data),
        hoje,
      });
      await db.vencimento.createMany({
        data: faltam.map((data) => ({
          usuarioId: estudio.usuario.id,
          repeticaoId: repeticao.id,
          descricao: "Aluguel",
          valorCentavos: 80000,
          data,
        })),
        skipDuplicates: true,
      });
    }

    const gravados = await db.vencimento.findMany({
      where: { repeticaoId: repeticao.id },
      orderBy: { data: "asc" },
      select: { data: true },
    });

    expect(gravados).toHaveLength(12);
    const datas = gravados.map((item) => paraDataPura(item.data));
    expect(new Set(datas).size).toBe(12);
    // Dia 30 em todos os meses que têm 30, e o último dia em fevereiro.
    expect(datas[0]).toBe("2026-10-30");
    expect(datas[4]).toBe("2027-02-28");
  });

  it("marcar como pago duas vezes não lança duas saídas", async () => {
    const db = await banco();

    const vencimento = await db.vencimento.create({
      data: {
        usuarioId: estudio.usuario.id,
        descricao: "Conta de luz",
        valorCentavos: 24000,
        data: dia("2026-10-10"),
      },
    });

    // A condição `pago: false` é a mesma da ação de verdade.
    const primeira = await db.vencimento.updateMany({
      where: { id: vencimento.id, usuarioId: estudio.usuario.id, pago: false },
      data: { pago: true, pagoEm: dia("2026-10-10") },
    });
    const segunda = await db.vencimento.updateMany({
      where: { id: vencimento.id, usuarioId: estudio.usuario.id, pago: false },
      data: { pago: true, pagoEm: dia("2026-10-10") },
    });

    expect(primeira.count).toBe(1);
    expect(segunda.count).toBe(0);
  });

  it("um estúdio não vê nem paga o vencimento do outro", async () => {
    const db = await banco();
    const outro = await montarEstudio("vizinho");

    const vencimento = await db.vencimento.create({
      data: {
        usuarioId: outro.usuario.id,
        descricao: "Aluguel do vizinho",
        valorCentavos: 100000,
        data: dia("2026-10-10"),
      },
    });

    expect(
      await db.vencimento.findFirst({
        where: { id: vencimento.id, usuarioId: estudio.usuario.id },
      }),
    ).toBeNull();

    const tentou = await db.vencimento.updateMany({
      where: { id: vencimento.id, usuarioId: estudio.usuario.id, pago: false },
      data: { pago: true },
    });
    expect(tentou.count).toBe(0);
  });

  it("a data volta do banco no mesmo dia em que entrou", async () => {
    const db = await banco();
    const vencimento = await db.vencimento.create({
      data: {
        usuarioId: estudio.usuario.id,
        descricao: "Primeiro do mês",
        valorCentavos: 1000,
        data: dia("2027-01-01"),
      },
    });
    const lido = await db.vencimento.findUniqueOrThrow({ where: { id: vencimento.id } });
    expect(paraDataPura(lido.data)).toBe("2027-01-01");
  });
});
