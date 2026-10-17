/**
 * Fechar e reabrir o mês.
 *
 * Fechar grava o relatório inteiro do mês, congelado, e liga a trava: a partir
 * daí nenhum caminho do Bossa cria, muda ou apaga dinheiro com data nele (ver
 * trava.ts). Reabrir desliga a trava e fica registrado; fechar de novo grava
 * um resumo novo, com o que mudou.
 */
import type { Prisma, PrismaClient } from "@/generated/prisma";
import { competenciaAtual } from "@/lib/formato";
import { mesValido } from "@/lib/custos/calculo";
import { carregarDadosDoMes } from "@/lib/relatorio/operacoes";
import { montarRelatorio, type RelatorioDoMes } from "@/lib/relatorio/montar";
import { travarFechamentoDoEstudio } from "./trava";

type Banco = PrismaClient;

export type ResultadoDoFechamento =
  | { erro: string }
  | { resultado: "fechado"; relatorio: RelatorioDoMes }
  | { resultado: "ja_fechado" };

export async function fecharMes(
  db: Banco,
  usuarioId: string,
  mes: string,
  agora: Date,
): Promise<ResultadoDoFechamento> {
  if (!mesValido(mes)) return { erro: "Não entendi o mês. Escolha de novo, por favor." };
  if (mes > competenciaAtual(agora)) {
    return { erro: "Esse mês ainda não começou. Dá para fechar só o mês atual ou os anteriores." };
  }

  return db.$transaction(async (tx) => {
    // A mesma trava de quem grava dinheiro: ninguém lança no meio do fechamento.
    await travarFechamentoDoEstudio(tx, usuarioId);

    const atual = await tx.fechamentoDoMes.findUnique({
      where: { usuarioId_competencia: { usuarioId, competencia: mes } },
      select: { fechado: true },
    });
    if (atual?.fechado) return { resultado: "ja_fechado" as const };

    const relatorio = montarRelatorio(await carregarDadosDoMes(tx, usuarioId, mes, agora));
    // O relatório é só texto e números inteiros: cabe no JSON sem conversão.
    const resumo = relatorio as unknown as Prisma.InputJsonValue;

    await tx.fechamentoDoMes.upsert({
      where: { usuarioId_competencia: { usuarioId, competencia: mes } },
      create: { usuarioId, competencia: mes, fechado: true, resumo, fechadoEm: agora },
      update: { fechado: true, resumo, fechadoEm: agora },
    });
    await tx.registroDeFechamento.create({
      data: { usuarioId, competencia: mes, acao: "fechou", criadoEm: agora },
    });

    return { resultado: "fechado" as const, relatorio };
  });
}

export async function reabrirMes(
  db: Banco,
  usuarioId: string,
  mes: string,
  agora: Date,
): Promise<{ erro: string } | { resultado: "reaberto" | "nao_estava_fechado" }> {
  if (!mesValido(mes)) return { erro: "Não entendi o mês. Escolha de novo, por favor." };

  return db.$transaction(async (tx) => {
    await travarFechamentoDoEstudio(tx, usuarioId);
    const mudados = await tx.fechamentoDoMes.updateMany({
      where: { usuarioId, competencia: mes, fechado: true },
      data: { fechado: false, reabertoEm: agora },
    });
    if (mudados.count === 0) return { resultado: "nao_estava_fechado" as const };

    await tx.registroDeFechamento.create({
      data: { usuarioId, competencia: mes, acao: "reabriu", criadoEm: agora },
    });
    return { resultado: "reaberto" as const };
  });
}

/** Cada vez que o mês foi fechado ou reaberto, do mais recente para o mais antigo. */
export async function historicoDoMes(db: Prisma.TransactionClient, usuarioId: string, mes: string) {
  return db.registroDeFechamento.findMany({
    where: { usuarioId, competencia: mes },
    orderBy: { criadoEm: "desc" },
    take: 20,
    select: { acao: true, criadoEm: true },
  });
}
