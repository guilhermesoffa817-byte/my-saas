/**
 * Mudar a situação de um horário e apagar um horário, do jeito que a tela faz
 * e o teste confere.
 *
 * Atendimento concluído é dinheiro: as Finanças somam o preço do serviço de
 * todo atendimento concluído no mês. Por isso concluir, desfazer a conclusão
 * ou apagar um concluído passa pela trava do mês fechado. Marcar, cancelar ou
 * apagar um horário que nunca foi concluído não mexe em dinheiro e segue livre.
 *
 * Tirar um horário de "cancelado" é como marcar de novo: o lugar dele pode já
 * ter sido ocupado, inclusive por um cliente pelo link. Por isso essa volta
 * passa pela mesma conferência de choque de horário de quem marca.
 */
import type { Prisma, PrismaClient } from "@/generated/prisma";
import { travarAgendaDoEstudio } from "@/lib/agenda-trava";
import { conferirMesesAbertos, mesDoInstante } from "@/lib/fechamento/trava";
import { emReais, hora, somarDias } from "@/lib/formato";

type Banco = PrismaClient;

/**
 * Com equipe, duas pessoas atendem ao mesmo tempo. O choque de horário só vale
 * entre atendimentos da mesma pessoa; os sem "quem atende" são da própria dona
 * e se chocam entre si, como sempre foi para quem trabalha sozinha.
 *
 * Só vale de verdade dentro de uma transação com `travarAgendaDoEstudio`.
 */
export async function horarioOcupado(
  db: Prisma.TransactionClient,
  {
    usuarioId,
    inicio,
    duracaoMin,
    ignorarId,
    colaboradorId = null,
  }: {
    usuarioId: string;
    inicio: Date;
    duracaoMin: number;
    ignorarId?: string;
    colaboradorId?: string | null;
  },
) {
  const fim = new Date(inicio.getTime() + duracaoMin * 60 * 1000);

  const candidatos = await db.agendamento.findMany({
    where: {
      usuarioId,
      colaboradorId,
      status: { not: "cancelado" },
      inicio: { gte: somarDias(inicio, -1), lte: somarDias(inicio, 1) },
      ...(ignorarId ? { id: { not: ignorarId } } : {}),
    },
    include: { cliente: true, servico: true },
  });

  return candidatos.find((item) => {
    const fimExistente = new Date(
      item.inicio.getTime() + item.servico.duracaoMin * 60 * 1000,
    );
    return item.inicio < fim && inicio < fimExistente;
  });
}

/** O recado de quando um horário cancelado não pode voltar: o lugar já foi ocupado. */
export const HORARIO_JA_OCUPADO =
  "Esse horário já foi ocupado por outro atendimento depois do cancelamento. Marque o cliente em outro horário.";

export const STATUS_DO_HORARIO = ["agendado", "concluido", "cancelado"] as const;
export type StatusDoHorario = (typeof STATUS_DO_HORARIO)[number];

export type ResultadoNaAgenda =
  | { resultado: "feito" | "nao_encontrado"; inicio?: Date }
  | { erro: string; inicio: Date; motivo: "mes_fechado" | "ocupado" };

export async function mudarStatusDoHorario(
  db: Banco,
  usuarioId: string,
  entrada: { id: string; status: StatusDoHorario; cancelarCobranca: boolean },
): Promise<ResultadoNaAgenda> {
  return db.$transaction(async (tx) => {
    const agendamento = await tx.agendamento.findFirst({
      where: { id: entrada.id, usuarioId },
      select: {
        id: true,
        status: true,
        inicio: true,
        colaboradorId: true,
        servico: { select: { duracaoMin: true } },
      },
    });
    if (!agendamento) return { resultado: "nao_encontrado" as const };

    /*
      A trava da agenda vem antes da do fechamento, na mesma ordem de quem
      marca: um cliente pelo link no mesmo segundo espera esta conferência.
    */
    if (agendamento.status === "cancelado" && entrada.status !== "cancelado") {
      await travarAgendaDoEstudio(tx, usuarioId);
      const choque = await horarioOcupado(tx, {
        usuarioId,
        inicio: agendamento.inicio,
        duracaoMin: agendamento.servico.duracaoMin,
        ignorarId: agendamento.id,
        colaboradorId: agendamento.colaboradorId,
      });
      if (choque) {
        return { erro: HORARIO_JA_OCUPADO, inicio: agendamento.inicio, motivo: "ocupado" as const };
      }
    }

    const mexeEmDinheiro =
      agendamento.status !== entrada.status &&
      (agendamento.status === "concluido" || entrada.status === "concluido");
    if (mexeEmDinheiro) {
      const fechado = await conferirMesesAbertos(tx, usuarioId, [mesDoInstante(agendamento.inicio)]);
      if (fechado) return { erro: fechado.erro, inicio: agendamento.inicio, motivo: "mes_fechado" as const };
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
      if (fechado) return { erro: fechado.erro, inicio: agendamento.inicio, motivo: "mes_fechado" as const };
    }

    await tx.agendamento.deleteMany({ where: { id: agendamento.id, usuarioId } });
    return { resultado: "feito" as const, inicio: agendamento.inicio };
  });
}

export type EntradaDaRemarcacao = {
  id: string;
  inicio: Date;
  servicoId: string;
  /** `undefined` mantém quem já atendia; `null` é a própria dona. */
  colaboradorId?: string | null;
};

export type ResultadoDaRemarcacao =
  | { ok: true; inicio: Date; mudou: boolean }
  | { erro: string };

/**
 * Remarcar: muda o dia e a hora, o serviço e quem atende de um horário ainda
 * agendado. Cliente, observação e a marca "Marcado pelo link" ficam como
 * estavam, que é o que se perdia apagando e marcando de novo.
 *
 * A conferência de choque é a mesma de quem marca, dentro da mesma trava da
 * agenda, ignorando o próprio horário (mudar 15 minutos para frente não pode
 * esbarrar nele mesmo). Concluído e cancelado não se remarcam: o concluído já
 * é dinheiro do mês, e o cancelado volta para agendado antes.
 *
 * Trocar o serviço de um horário que já tem cobrança deixaria o valor da
 * cobrança diferente do serviço; nesse caso só o dia, a hora e quem atende
 * podem mudar.
 */
export async function remarcarHorarioNoBanco(
  db: Banco,
  usuarioId: string,
  entrada: EntradaDaRemarcacao,
): Promise<ResultadoDaRemarcacao> {
  return db.$transaction(async (tx) => {
    // A trava vem antes da leitura: ninguém conclui nem marca por cima no meio.
    await travarAgendaDoEstudio(tx, usuarioId);

    const atual = await tx.agendamento.findFirst({
      where: { id: entrada.id, usuarioId },
      select: {
        id: true,
        status: true,
        inicio: true,
        servicoId: true,
        colaboradorId: true,
        cobrancas: { where: { situacao: { not: "cancelada" } }, select: { valorCentavos: true } },
      },
    });
    if (!atual) return { erro: "Não encontramos esse horário na sua agenda." };
    if (atual.status === "concluido") {
      return { erro: "Esse atendimento já foi concluído. Para mudar o horário, volte para agendado antes." };
    }
    if (atual.status === "cancelado") {
      return { erro: "Esse horário foi cancelado. Volte para agendado antes de remarcar." };
    }

    const servico = await tx.servico.findFirst({
      where: { id: entrada.servicoId, usuarioId },
      select: { id: true, duracaoMin: true },
    });
    if (!servico) return { erro: "Não encontramos esse serviço na sua lista." };

    if (servico.id !== atual.servicoId && atual.cobrancas.length > 0) {
      return {
        erro: `Esse horário já tem cobrança de ${emReais(atual.cobrancas[0].valorCentavos)}. Para trocar o serviço, cancele a cobrança antes; o dia e a hora podem mudar à vontade.`,
      };
    }

    const colaboradorId =
      entrada.colaboradorId === undefined ? atual.colaboradorId : entrada.colaboradorId;

    const mudou =
      atual.inicio.getTime() !== entrada.inicio.getTime() ||
      atual.servicoId !== servico.id ||
      atual.colaboradorId !== colaboradorId;
    if (!mudou) return { ok: true as const, inicio: atual.inicio, mudou: false };

    const choque = await horarioOcupado(tx, {
      usuarioId,
      inicio: entrada.inicio,
      duracaoMin: servico.duracaoMin,
      ignorarId: atual.id,
      colaboradorId,
    });
    if (choque) {
      return {
        erro: `Esse horário esbarra no atendimento de ${choque.cliente.nome}, às ${hora(choque.inicio)}. Que tal outro horário?`,
      };
    }

    await tx.agendamento.updateMany({
      where: { id: atual.id, usuarioId, status: "agendado" },
      data: { inicio: entrada.inicio, servicoId: servico.id, colaboradorId },
    });
    return { ok: true as const, inicio: entrada.inicio, mudou: true };
  });
}
