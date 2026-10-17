/**
 * A trava do mês fechado, num lugar só.
 *
 * Todo caminho que cria, muda ou apaga dinheiro com data num mês passa por
 * `conferirMesesAbertos` antes de gravar: lançamento das Finanças, pagamento da
 * Equipe, conta a pagar criada, gerada, paga ou apagada, cobrança recebida,
 * atendimento concluído e cliente apagado com atendimento concluído. Se um dos meses tocados estiver fechado,
 * nada é gravado e a tela mostra `MES_FECHADO`.
 *
 * A conferência só vale dentro da mesma transação da gravação, e as duas pegam
 * a mesma trava do Postgres que o "Fechar o mês" pega. Sem isso, a dona
 * poderia fechar o mês no mesmo segundo em que um lançamento estava entrando:
 * o lançamento conferiria "aberto", o fechamento congelaria o resumo sem ele,
 * e o mês fechado teria um número diferente do resumo guardado.
 */
import type { Prisma } from "@/generated/prisma";
import { competenciaAtual, paraDataPura } from "@/lib/formato";

type Transacao = Prisma.TransactionClient;

export const MES_FECHADO = "Este mês está fechado. Reabra para alterar.";

export class MesFechadoErro extends Error {
  constructor(public competencia: string) {
    super(MES_FECHADO);
    this.name = "MesFechadoErro";
  }
}

/**
 * Fila única por estúdio entre quem grava dinheiro e quem fecha ou reabre o
 * mês. Solta sozinha no fim da transação, inclusive quando dá erro.
 */
export async function travarFechamentoDoEstudio(tx: Transacao, usuarioId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`fechamento:${usuarioId}`}, 0))`;
}

/** O mês de um instante (lançamento, atendimento), contado no fuso do estúdio. */
export function mesDoInstante(data: Date) {
  return competenciaAtual(data);
}

/** O mês de um dia de calendário (pagamento, vencimento), sem passar por fuso. */
export function mesDoDiaPuro(data: Date) {
  return paraDataPura(data).slice(0, 7);
}

/**
 * Pega a trava e diz qual dos meses está fechado, ou null se todos estão
 * abertos. Precisa ser chamada com a transação que vai gravar.
 */
export async function mesFechadoEntre(
  tx: Transacao,
  usuarioId: string,
  meses: (string | null | undefined)[],
): Promise<string | null> {
  await travarFechamentoDoEstudio(tx, usuarioId);
  const unicos = [...new Set(meses.filter((mes): mes is string => Boolean(mes)))];
  if (unicos.length === 0) return null;
  const fechado = await tx.fechamentoDoMes.findFirst({
    where: { usuarioId, competencia: { in: unicos }, fechado: true },
    select: { competencia: true },
    orderBy: { competencia: "asc" },
  });
  return fechado?.competencia ?? null;
}

/**
 * A forma usada por quem grava: devolve `{ erro }` pronto para a tela quando
 * algum mês está fechado, ou null para seguir.
 */
export async function conferirMesesAbertos(
  tx: Transacao,
  usuarioId: string,
  meses: (string | null | undefined)[],
): Promise<{ erro: string; competencia: string } | null> {
  const fechado = await mesFechadoEntre(tx, usuarioId, meses);
  return fechado ? { erro: MES_FECHADO, competencia: fechado } : null;
}

/**
 * Para quem grava no meio de uma transação maior e precisa desfazer tudo:
 * lança o erro, o Prisma desfaz a transação, e quem chamou traduz para a tela.
 */
export async function exigirMesesAbertos(
  tx: Transacao,
  usuarioId: string,
  meses: (string | null | undefined)[],
) {
  const fechado = await mesFechadoEntre(tx, usuarioId, meses);
  if (fechado) throw new MesFechadoErro(fechado);
}

/** Os meses fechados de um estúdio, para as telas esconderem o que não pode mudar. */
export async function mesesFechados(db: Transacao, usuarioId: string): Promise<Set<string>> {
  const linhas = await db.fechamentoDoMes.findMany({
    where: { usuarioId, fechado: true },
    select: { competencia: true },
  });
  return new Set(linhas.map((linha) => linha.competencia));
}
