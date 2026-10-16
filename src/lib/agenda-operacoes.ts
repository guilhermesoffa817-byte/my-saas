/**
 * Mudar a situação de um horário e apagar um horário, do jeito que a tela faz
 * e o teste confere.
 *
 * Atendimento concluído é dinheiro: as Finanças somam o preço do serviço de
 * todo atendimento concluído no mês. Por isso concluir, desfazer a conclusão
 * ou apagar um concluído passa pela trava do mês fechado. Marcar, cancelar ou
 * apagar um horário que nunca foi concluído não mexe em dinheiro e segue livre.
 */
import type { PrismaClient } from "@/generated/prisma";
import { conferirMesesAbertos, mesDoInstante } from "@/lib/fechamento/trava";

type Banco = PrismaClient;

export const STATUS_DO_HORARIO = ["agendado", "concluido", "cancelado"] as const;
export type StatusDoHorario = (typeof STATUS_DO_HORARIO)[number];

export type ResultadoNaAgenda =
  | { resultado: "feito" | "nao_encontrado"; inicio?: Date }
  | { erro: string; inicio: Date };

export async function mudarStatusDoHorario(
  db: Banco,
  usuarioId: string,
  entrada: { id: string; status: StatusDoHorario; cancelarCobranca: boolean },
): Promise<ResultadoNaAgenda> {
  return db.$transaction(async (tx) => {
    const agendamento = await tx.agendamento.findFirst({
      where: { id: entrada.id, usuarioId },
      select: { id: true, status: true, inicio: true },
    });
    if (!agendamento) return { resultado: "nao_encontrado" as const };

    const mexeEmDinheiro =
      agendamento.status !== entrada.status &&
      (agendamento.status === "concluido" || entrada.status === "concluido");
    if (mexeEmDinheiro) {
      const fechado = await conferirMesesAbertos(tx, usuarioId, [mesDoInstante(agendamento.inicio)]);
      if (fechado) return { erro: fechado.erro, inicio: agendamento.inicio };
    }

    await tx.agendamento.updateMany({
      where: { id: agendamento.id, usuarioId },
      data: { status: entrada.status },
    });

    /*
      Cancelar o horário não cancela a cobrança por conta própria: o atendimento
      pode ter sido desmarcado e o valor seguir devido. A tela pergunta, e a
      resposta chega aqui. Sem resposta, a cobrança fica como está.
    */
    if (entrada.status === "cancelado" && entrada.cancelarCobranca) {
      await tx.cobranca.updateMany({
        where: { agendamentoId: agendamento.id, usuarioId, situacao: "aberta" },
        data: { situacao: "cancelada" },
      });
    }

    return { resultado: "feito" as const, inicio: agendamento.inicio };
  });
}

export async function apagarHorario(
  db: Banco,
  usuarioId: string,
  id: string,
): Promise<ResultadoNaAgenda> {
  return db.$transaction(async (tx) => {
    const agendamento = await tx.agendamento.findFirst({
      where: { id, usuarioId },
      select: { id: true, status: true, inicio: true },
    });
    if (!agendamento) return { resultado: "nao_encontrado" as const };

    if (agendamento.status === "concluido") {
      const fechado = await conferirMesesAbertos(tx, usuarioId, [mesDoInstante(agendamento.inicio)]);
      if (fechado) return { erro: fechado.erro, inicio: agendamento.inicio };
    }

    await tx.agendamento.deleteMany({ where: { id: agendamento.id, usuarioId } });
    return { resultado: "feito" as const, inicio: agendamento.inicio };
  });
}
