import type { Prisma } from "@/generated/prisma";

/**
 * Fila única para mexer na agenda de um estúdio.
 *
 * Conferir se o horário está livre e gravar o atendimento são dois passos.
 * Sem trava, dois pedidos ao mesmo tempo (dois clientes pelo link, ou um
 * cliente pelo link e a dona pelo painel) conferem juntos, os dois veem o
 * horário livre e os dois gravam. A trava do Postgres (pg_advisory_xact_lock)
 * faz o segundo esperar o primeiro terminar a transação; quando ele confere,
 * já enxerga o horário ocupado.
 *
 * A trava é por estúdio: a agenda de um nunca espera pela do outro. Ela se
 * solta sozinha no fim da transação, inclusive quando dá erro.
 */
export async function travarAgendaDoEstudio(tx: Prisma.TransactionClient, usuarioId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`agenda:${usuarioId}`}, 0))`;
}
