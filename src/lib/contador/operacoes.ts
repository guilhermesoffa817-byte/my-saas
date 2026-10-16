/**
 * O link do contador: /contador/<código>, sem login.
 *
 * O código tem 32 bytes aleatórios (256 bits), então adivinhar é impossível na
 * prática; mesmo assim, cada IP tem um limite de tentativas erradas por hora,
 * para que ninguém fique varrendo endereços. O banco guarda só o SHA-256 do
 * código, como no pedido de nova senha: quem abrir o banco não monta o link.
 *
 * Toda leitura do contador passa por `abrirPeloCodigo`, que devolve o estúdio
 * dono do link. Depois disso, as consultas filtram por esse estúdio, igual às
 * telas da dona, e só leem o relatório: nada aqui grava dinheiro.
 */
import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma";
import { temFinanceiro } from "@/lib/assinatura";

type Banco = PrismaClient;

/** Tentativas erradas por IP numa hora, antes de a página parar de responder. */
export const LIMITE_DE_TENTATIVAS_POR_HORA = 10;
const UMA_HORA_MS = 60 * 60 * 1000;
/** As tentativas só servem para a conta da última hora; com um dia, saem. */
const GUARDA_DAS_TENTATIVAS_MS = 24 * UMA_HORA_MS;

/** 32 bytes em base64url: 43 letras, números, "-" e "_". */
const FORMATO_DO_CODIGO = /^[A-Za-z0-9_-]{43}$/;

export function gerarCodigo() {
  return randomBytes(32).toString("base64url");
}

export function resumoDoCodigo(codigo: string) {
  return createHash("sha256").update(codigo).digest("hex");
}

/**
 * Gera um link novo e revoga os anteriores, na mesma transação: nunca ficam
 * dois links valendo. Devolve o código, que só existe agora: a tela mostra uma
 * vez e não tem como mostrar de novo.
 */
export async function gerarAcesso(db: Banco, usuarioId: string, agora: Date) {
  const codigo = gerarCodigo();
  await db.$transaction(async (tx) => {
    await tx.acessoDoContador.updateMany({
      where: { usuarioId, revogadoEm: null },
      data: { revogadoEm: agora },
    });
    await tx.acessoDoContador.create({
      data: { usuarioId, codigoHash: resumoDoCodigo(codigo), criadoEm: agora },
    });
  });
  return codigo;
}

export async function revogarAcesso(db: Banco, usuarioId: string, agora: Date) {
  const mudados = await db.acessoDoContador.updateMany({
    where: { usuarioId, revogadoEm: null },
    data: { revogadoEm: agora },
  });
  return mudados.count > 0;
}

/** O link que vale agora, sem o código (que não se guarda). */
export async function acessoAtual(db: Banco, usuarioId: string) {
  return db.acessoDoContador.findFirst({
    where: { usuarioId, revogadoEm: null },
    orderBy: { criadoEm: "desc" },
    select: { criadoEm: true, ultimoAcessoEm: true },
  });
}

/** O último link revogado, para a tela dizer quando foi a última visita dele. */
export async function ultimoRevogado(db: Banco, usuarioId: string) {
  return db.acessoDoContador.findFirst({
    where: { usuarioId, revogadoEm: { not: null } },
    orderBy: { revogadoEm: "desc" },
    select: { revogadoEm: true, ultimoAcessoEm: true },
  });
}

export type Abertura =
  | { situacao: "aberto"; usuarioId: string; nomeNegocio: string }
  | { situacao: "nao_encontrado" }
  /** O estúdio existe, mas está sem o plano: a página não diz o motivo. */
  | { situacao: "indisponivel" }
  | { situacao: "bloqueado" };

/**
 * Confere o código e devolve o estúdio dono dele.
 *
 * Código errado, revogado ou fora do formato contam como tentativa do IP. Com
 * o limite estourado, nem o código certo abre: senão o limite não seguraria
 * quem está tentando adivinhar.
 */
export async function abrirPeloCodigo(
  db: Banco,
  codigo: string,
  ipHash: string,
  agora: Date,
): Promise<Abertura> {
  const desde = new Date(agora.getTime() - UMA_HORA_MS);
  const erradas = await db.tentativaDoContador.count({
    where: { ipHash, criadoEm: { gt: desde } },
  });
  if (erradas >= LIMITE_DE_TENTATIVAS_POR_HORA) return { situacao: "bloqueado" };

  const acesso = FORMATO_DO_CODIGO.test(codigo)
    ? await db.acessoDoContador.findUnique({
        where: { codigoHash: resumoDoCodigo(codigo) },
        select: {
          id: true,
          revogadoEm: true,
          usuario: {
            select: {
              id: true,
              nomeNegocio: true,
              assinatura: { select: { status: true, plano: true, validaAte: true } },
            },
          },
        },
      })
    : null;

  if (!acesso || acesso.revogadoEm) {
    await db.tentativaDoContador.create({ data: { ipHash, criadoEm: agora } });
    try {
      await db.tentativaDoContador.deleteMany({
        where: { criadoEm: { lt: new Date(agora.getTime() - GUARDA_DAS_TENTATIVAS_MS) } },
      });
    } catch {
      // Faxina que falha hoje é feita na próxima tentativa.
    }
    return { situacao: "nao_encontrado" };
  }

  if (!temFinanceiro(acesso.usuario.assinatura, agora)) return { situacao: "indisponivel" };

  await db.acessoDoContador.update({
    where: { id: acesso.id },
    data: { ultimoAcessoEm: agora },
  });

  return { situacao: "aberto", usuarioId: acesso.usuario.id, nomeNegocio: acesso.usuario.nomeNegocio };
}
