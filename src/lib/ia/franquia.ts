import "server-only";

import type { PrismaClient } from "@/generated/prisma";
import { inicioDoMes, inicioDoProximoMes } from "@/lib/formato";
import type { RecursoDeIa } from "@/lib/recursos";

/**
 * A franquia mensal de IA de cada estúdio.
 *
 * O jeito ingênuo ("conta quanto usou; se couber, chama a API") deixa dois
 * cliques ao mesmo tempo passarem juntos do limite: os dois contam antes de
 * qualquer um gravar. Aqui a conta e a gravação acontecem numa transação que
 * trava a conta do estúdio para aquele recurso. O segundo pedido espera o
 * primeiro terminar e já conta o que ele reservou.
 *
 * Sequência de uso:
 * 1. `reservarUsoDeIa` ANTES de chamar a API;
 * 2. `atualizarUsoDeIa` com os tokens quando a resposta chegar;
 * 3. `devolverUsoDeIa` com o que não chegou a ser enviado.
 *
 * Toda função recebe o banco por parâmetro (os testes passam o de teste) e
 * filtra pelo estúdio: um id de reserva sozinho não mexe em nada.
 */

type Banco = PrismaClient;

/** O pedaço de `response.usage` que interessa para a conta. */
export type UsoDaApi = {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

/** Soma o uso de várias chamadas (um lote recusado vira várias). */
export function somarUso(usos: UsoDaApi[]) {
  return usos.reduce(
    (total, uso) => ({
      tokensEntrada: total.tokensEntrada + (uso.input_tokens ?? 0),
      tokensSaida: total.tokensSaida + (uso.output_tokens ?? 0),
      tokensCacheLeitura: total.tokensCacheLeitura + (uso.cache_read_input_tokens ?? 0),
      tokensCacheEscrita: total.tokensCacheEscrita + (uso.cache_creation_input_tokens ?? 0),
      buscasNaWeb: total.buscasNaWeb + (uso.server_tool_use?.web_search_requests ?? 0),
    }),
    { tokensEntrada: 0, tokensSaida: 0, tokensCacheLeitura: 0, tokensCacheEscrita: 0, buscasNaWeb: 0 },
  );
}

/** Quanto da franquia o estúdio já gastou no mês corrente, no fuso do estúdio. */
export async function usoDeIaNoMes(
  db: Banco,
  usuarioId: string,
  recurso: RecursoDeIa,
  agora = new Date(),
) {
  const soma = await db.usoDeIa.aggregate({
    where: {
      usuarioId,
      recurso,
      criadoEm: { gte: inicioDoMes(agora), lt: inicioDoProximoMes(agora) },
    },
    _sum: { unidades: true },
  });
  return soma._sum.unidades ?? 0;
}

export type CotaDeIa = { limite: number; usados: number; restantes: number };

/** Só para MOSTRAR o saldo. Para liberar a IA, use `reservarUsoDeIa`. */
export async function cotaDeIa(
  db: Banco,
  usuarioId: string,
  recurso: RecursoDeIa,
  limite: number,
  agora = new Date(),
): Promise<CotaDeIa> {
  const usados = await usoDeIaNoMes(db, usuarioId, recurso, agora);
  return { limite, usados, restantes: Math.max(0, limite - usados) };
}

export type ReservaDeIa =
  | { ok: true; id: string; unidades: number }
  /** A franquia não cobre o pedido. `restantes` é quanto ainda cabe (0 = acabou). */
  | { ok: false; restantes: number };

/**
 * Reserva `unidades` da franquia, de forma atômica. Grava a linha antes da
 * chamada à API: se a API cobrar e o servidor cair no meio, o uso já está
 * contado.
 */
export async function reservarUsoDeIa(
  db: Banco,
  params: {
    usuarioId: string;
    recurso: RecursoDeIa;
    limite: number;
    unidades?: number;
    agora?: Date;
  },
): Promise<ReservaDeIa> {
  const unidades = params.unidades ?? 1;
  const agora = params.agora ?? new Date();
  if (!Number.isInteger(unidades) || unidades <= 0) {
    throw new Error("A reserva precisa de pelo menos uma unidade.");
  }

  return db.$transaction(
    async (tx) => {
      /*
        A trava vale até o fim desta transação e só segura este estúdio neste
        recurso: o assistente de uma conta não espera a classificação de outra.
      */
      const chave = `${params.usuarioId}:${params.recurso}`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('uso_de_ia'), hashtext(${chave}::text))`;

      const soma = await tx.usoDeIa.aggregate({
        where: {
          usuarioId: params.usuarioId,
          recurso: params.recurso,
          criadoEm: { gte: inicioDoMes(agora), lt: inicioDoProximoMes(agora) },
        },
        _sum: { unidades: true },
      });
      const usados = soma._sum.unidades ?? 0;
      const restantes = Math.max(0, params.limite - usados);
      if (unidades > restantes) return { ok: false, restantes } as const;

      const linha = await tx.usoDeIa.create({
        data: {
          usuarioId: params.usuarioId,
          recurso: params.recurso,
          unidades,
          criadoEm: agora,
        },
        select: { id: true },
      });
      return { ok: true, id: linha.id, unidades } as const;
    },
    { timeout: 10_000 },
  );
}

/**
 * Grava os tokens de uma reserva. Passe sempre o TOTAL das chamadas que ela
 * cobriu: pode chamar mais de uma vez, a última vale.
 */
export async function atualizarUsoDeIa(
  db: Banco,
  params: { id: string; usuarioId: string; usos: UsoDaApi[] },
) {
  const mudou = await db.usoDeIa.updateMany({
    where: { id: params.id, usuarioId: params.usuarioId },
    data: somarUso(params.usos),
  });
  return mudou.count > 0;
}

/**
 * Devolve à franquia as unidades que não chegaram à API (um lote que nem saiu,
 * um erro antes da chamada). Se devolver tudo, a linha sai. Nunca lança:
 * devolver é cortesia, e uma falha aqui não pode esconder o erro original.
 */
export async function devolverUsoDeIa(
  db: Banco,
  params: { id: string; usuarioId: string; unidades: number },
) {
  if (params.unidades <= 0) return 0;
  try {
    const diminuiu = await db.usoDeIa.updateMany({
      where: { id: params.id, usuarioId: params.usuarioId, unidades: { gt: params.unidades } },
      data: { unidades: { decrement: params.unidades } },
    });
    if (diminuiu.count > 0) return params.unidades;
    const apagou = await db.usoDeIa.deleteMany({
      where: { id: params.id, usuarioId: params.usuarioId, unidades: { lte: params.unidades } },
    });
    return apagou.count > 0 ? params.unidades : 0;
  } catch {
    return 0;
  }
}
