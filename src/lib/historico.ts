/**
 * O histórico de uma cliente, resumido para a ficha dela.
 *
 * As contas são funções puras: recebem os atendimentos já lidos do banco e o
 * instante do pedido, e devolvem os números e as listas que a ficha mostra.
 * Assim a conta de "quanto ela já gastou" pode ser testada sem subir nada.
 *
 * No fim do arquivo ficam as duas escritas que dependem do histórico: tirar a
 * cliente da lista e devolvê-la.
 */

import type { PrismaClient } from "@/generated/prisma";
import { valorDoAtendimento } from "@/lib/atendimento";

export type AtendimentoDoHistorico = {
  inicio: Date;
  status: string;
  valorCentavos: number | null;
  servico: { precoCentavos: number };
};

export type ResumoDoHistorico<T> = {
  /** Só os concluídos. Falta e cancelamento não são visita. */
  visitas: number;
  /** A soma do valor combinado de cada atendimento concluído. */
  totalGastoCentavos: number;
  faltas: number;
  /** O concluído mais recente. */
  ultimaVisita: T | null;
  /** O próximo horário marcado, a partir de agora. */
  proximo: T | null;
};

export function resumoDoHistorico<T extends AtendimentoDoHistorico>(
  atendimentos: T[],
  agora: Date,
): ResumoDoHistorico<T> {
  let visitas = 0;
  let totalGastoCentavos = 0;
  let faltas = 0;
  let ultimaVisita: T | null = null;
  let proximo: T | null = null;

  for (const atendimento of atendimentos) {
    if (atendimento.status === "concluido") {
      visitas += 1;
      // O valor combinado na hora de marcar, e não o preço de hoje do serviço:
      // subir o preço não pode mudar o que ela já pagou.
      totalGastoCentavos += valorDoAtendimento(atendimento);
      if (!ultimaVisita || atendimento.inicio > ultimaVisita.inicio) {
        ultimaVisita = atendimento;
      }
    } else if (atendimento.status === "faltou") {
      faltas += 1;
    } else if (atendimento.status === "agendado" && atendimento.inicio >= agora) {
      if (!proximo || atendimento.inicio < proximo.inicio) proximo = atendimento;
    }
  }

  return { visitas, totalGastoCentavos, faltas, ultimaVisita, proximo };
}

/**
 * Separa o que ainda vai acontecer do que já passou.
 *
 * Os próximos são só os horários de pé: um cancelamento marcado para a semana
 * que vem não é compromisso. Os anteriores vêm do mais recente para o mais
 * antigo, cortados no limite, porque a ficha de uma cliente de anos não pode
 * virar uma rolagem sem fim no celular.
 */
export function separarAtendimentos<T extends AtendimentoDoHistorico>(
  atendimentos: T[],
  agora: Date,
  limite = 20,
): { proximos: T[]; anteriores: T[]; anterioresForaDaLista: number } {
  const proximos = atendimentos
    .filter((item) => item.status === "agendado" && item.inicio >= agora)
    .sort((a, b) => a.inicio.getTime() - b.inicio.getTime());

  const todosAnteriores = atendimentos
    .filter((item) => item.inicio < agora)
    .sort((a, b) => b.inicio.getTime() - a.inicio.getTime());

  return {
    proximos,
    anteriores: todosAnteriores.slice(0, limite),
    anterioresForaDaLista: Math.max(0, todosAnteriores.length - limite),
  };
}

/**
 * Cliente com algum atendimento ou cobrança tem histórico, e quem tem
 * histórico não é apagada: é arquivada. Apagar levaria junto, em cascata, as
 * cobranças pagas e os atendimentos concluídos, e o faturamento dos meses que
 * já passaram encolheria sem ninguém perceber.
 */
export function temHistorico(contagem: { atendimentos: number; cobrancas: number }) {
  return contagem.atendimentos > 0 || contagem.cobrancas > 0;
}

/**
 * A pergunta feita antes de tirar a cliente da lista. Diz o que vai acontecer
 * de verdade: arquivar ou apagar, e quantos horários marcados caem junto.
 */
export function perguntaParaTirarDaLista({
  nome,
  comHistorico,
  horariosMarcados,
}: {
  nome: string;
  comHistorico: boolean;
  horariosMarcados: number;
}) {
  if (!comHistorico) {
    return `Apagar a ficha de ${nome}? Ainda não há atendimento nem cobrança, então ela some de vez.`;
  }

  const horarios =
    horariosMarcados === 0
      ? ""
      : horariosMarcados === 1
        ? " O horário marcado dela será cancelado."
        : ` Os ${horariosMarcados} horários marcados dela serão cancelados.`;

  return `Arquivar a ficha de ${nome}? Ela sai da lista, mas os atendimentos e as cobranças continuam guardados e contando no faturamento.${horarios} Dá para desarquivar quando quiser.`;
}

export type ResultadoDeTirarDaLista =
  | { feito: "apagada" }
  | { feito: "arquivada"; horariosCancelados: number }
  | { feito: "nada" };

/**
 * Tira a cliente da lista: apaga quem não tem histórico e arquiva quem tem.
 *
 * Fica aqui, e não no arquivo da ação, para que o teste de banco rode
 * exatamente este código. Recebe o banco como parâmetro pelo mesmo motivo.
 *
 * A condição de "sem histórico" vai dentro do próprio DELETE, e não numa
 * consulta antes dele: se um horário for marcado no meio do caminho, o banco
 * simplesmente não apaga, e a cliente é arquivada.
 *
 * Ao arquivar, os horários marcados dali para a frente são cancelados na mesma
 * transação. Ficha arquivada não aparece na hora de marcar, e um horário de pé
 * para quem saiu da lista seria uma cadeira reservada para ninguém. Os
 * horários que já passaram ficam como estão, porque decidir se ela veio ou
 * faltou continua sendo da dona. As cobranças também não mudam: o que foi
 * combinado continua devido, do mesmo jeito que cancelar um horário na agenda
 * não cancela a cobrança dele.
 *
 * Tudo filtrado pelo estúdio: com o id de outro estúdio, nada muda.
 */
export async function tirarClienteDaLista(
  db: PrismaClient,
  { usuarioId, clienteId, agora }: { usuarioId: string; clienteId: string; agora: Date },
): Promise<ResultadoDeTirarDaLista> {
  return db.$transaction(async (tx) => {
    const apagadas = await tx.cliente.deleteMany({
      where: {
        id: clienteId,
        usuarioId,
        agendamentos: { none: {} },
        cobrancas: { none: {} },
      },
    });
    if (apagadas.count > 0) return { feito: "apagada" };

    const arquivadas = await tx.cliente.updateMany({
      where: { id: clienteId, usuarioId, arquivadoEm: null },
      data: { arquivadoEm: agora },
    });
    if (arquivadas.count === 0) return { feito: "nada" };

    const cancelados = await tx.agendamento.updateMany({
      where: { clienteId, usuarioId, status: "agendado", inicio: { gte: agora } },
      data: { status: "cancelado" },
    });

    return { feito: "arquivada", horariosCancelados: cancelados.count };
  });
}

/**
 * Devolve a cliente arquivada para a lista, com o histórico do jeito que
 * estava. Os horários cancelados no arquivamento continuam cancelados: o
 * horário pode já ter ido para outra pessoa.
 */
export async function devolverClienteParaLista(
  db: PrismaClient,
  { usuarioId, clienteId }: { usuarioId: string; clienteId: string },
) {
  const devolvidas = await db.cliente.updateMany({
    where: { id: clienteId, usuarioId, arquivadoEm: { not: null } },
    data: { arquivadoEm: null },
  });
  return devolvidas.count > 0;
}
