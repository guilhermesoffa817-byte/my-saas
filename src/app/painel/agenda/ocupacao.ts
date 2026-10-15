import type { PrismaClient } from "@/generated/prisma";
import { SITUACOES_QUE_OCUPAM } from "@/lib/atendimento";
import { somarDias } from "@/lib/formato";
import { seSobrepoem } from "./regras";

/**
 * O atendimento que já ocupa o horário pedido, se houver.
 *
 * Recebe o banco por parâmetro para que o teste de banco rode esta mesma
 * consulta, e não uma cópia dela. O estúdio entra sempre no filtro: a agenda de
 * outro estúdio nunca ocupa horário de ninguém.
 *
 * Só contam as situações que ocupam a cadeira. Falta e cancelamento liberam o
 * horário para outra pessoa. `ignorarId` serve ao remarcar, para o atendimento
 * não esbarrar nele mesmo.
 */
export async function horarioOcupado(
  db: Pick<PrismaClient, "agendamento">,
  {
    usuarioId,
    inicio,
    duracaoMin,
    ignorarId,
  }: {
    usuarioId: string;
    inicio: Date;
    duracaoMin: number;
    ignorarId?: string;
  },
) {
  const candidatos = await db.agendamento.findMany({
    where: {
      usuarioId,
      status: { in: SITUACOES_QUE_OCUPAM },
      inicio: { gte: somarDias(inicio, -1), lte: somarDias(inicio, 1) },
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
    },
    orderBy: { inicio: "asc" },
    select: {
      id: true,
      inicio: true,
      cliente: { select: { nome: true } },
      servico: { select: { duracaoMin: true } },
    },
  });

  return (
    candidatos.find((item) =>
      seSobrepoem(
        { inicio, duracaoMin },
        { inicio: item.inicio, duracaoMin: item.servico.duracaoMin },
      ),
    ) ?? null
  );
}
