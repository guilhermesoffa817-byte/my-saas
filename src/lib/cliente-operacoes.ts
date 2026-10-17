/**
 * Apagar um cliente, do jeito que a tela faz e o teste confere.
 *
 * Apagar o cliente leva junto, em cascata, os horários e as cobranças dele. Um
 * atendimento concluído é entrada do mês, e uma cobrança paga mudou o "a
 * receber" do mês em que foi paga: se algum desses meses estiver fechado, o
 * cliente fica, para o mês fechado não perder dinheiro por baixo.
 */
import type { PrismaClient } from "@/generated/prisma";
import { conferirMesesAbertos, mesDoDiaPuro, mesDoInstante } from "@/lib/fechamento/trava";

type Banco = PrismaClient;

export async function apagarCliente(
  db: Banco,
  usuarioId: string,
  id: string,
): Promise<{ erro: string } | { resultado: "apagado" | "nao_encontrado" }> {
  return db.$transaction(async (tx) => {
    const cliente = await tx.cliente.findFirst({
      where: { id, usuarioId },
      select: {
        id: true,
        agendamentos: { where: { status: "concluido" }, select: { inicio: true } },
        cobrancas: { where: { situacao: "paga" }, select: { pagaEm: true } },
      },
    });
    if (!cliente) return { resultado: "nao_encontrado" as const };

    const fechado = await conferirMesesAbertos(tx, usuarioId, [
      ...cliente.agendamentos.map((item) => mesDoInstante(item.inicio)),
      ...cliente.cobrancas.map((item) => (item.pagaEm ? mesDoDiaPuro(item.pagaEm) : null)),
    ]);
    if (fechado) return { erro: fechado.erro };

    await tx.cliente.deleteMany({ where: { id: cliente.id, usuarioId } });
    return { resultado: "apagado" as const };
  });
}
