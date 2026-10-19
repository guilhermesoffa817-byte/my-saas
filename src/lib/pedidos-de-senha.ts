/**
 * A fila de quem pediu senha nova, e o link que a atende.
 *
 * Um pedido nasce sem código: é só "fulana está esperando". Ele fica na fila
 * da administração até alguém gerar o link, por mais tempo que leve. O prazo
 * de meia hora (`expiraEm`) vale só para o link com código; para o pedido
 * sem código ele não quer dizer nada.
 *
 * Gerar o link fecha a fila daquela conta. Se o link não chegar, ou vencer,
 * e a pessoa pedir de novo, ela volta para a fila: um link já entregue não
 * conta como pedido esperando.
 *
 * Funções com o banco por parâmetro, para as ações, a tela da administração,
 * o comando de terminal (scripts/link-de-senha.ts) e os testes usarem a mesma
 * regra.
 */
import type { PrismaClient } from "@/generated/prisma";
import { gerarCodigo, resumoDoCodigo, validadeAPartirDe } from "@/lib/senha";

type Banco = Pick<PrismaClient, "pedidoDeSenha" | "$transaction">;

/** O que a administração ainda não atendeu: sem link gerado e sem ter sido fechado. */
const ESPERANDO = { usadoEm: null, entregueEm: null } as const;

/**
 * Registra um pedido, a menos que a conta já tenha um esperando: tocar no
 * botão de novo não enche a fila. Devolve se criou uma linha.
 */
export async function registrarPedidoDeSenha(db: Banco, usuarioId: string, agora: Date) {
  const esperando = await db.pedidoDeSenha.findFirst({
    where: { usuarioId, ...ESPERANDO },
    select: { id: true },
  });
  if (esperando) return false;

  await db.pedidoDeSenha.create({
    data: {
      usuarioId,
      criadoEm: agora,
      // Sem código ainda: ele nasce quando a administração gera o link.
      expiraEm: validadeAPartirDe(agora),
    },
  });
  return true;
}

/** Quem está esperando o link, do pedido mais antigo para o mais novo. */
export async function pedidosEsperando(db: Banco) {
  return db.pedidoDeSenha.findMany({
    where: ESPERANDO,
    orderBy: { criadoEm: "asc" },
    select: { usuarioId: true, criadoEm: true },
  });
}

/**
 * Gera o link de uma conta e devolve o código, que só existe agora: no banco
 * fica o resumo dele. Gerar um link novo derruba os anteriores e atende o
 * pedido que estava na fila.
 */
export async function criarLinkDeSenha(db: Banco, usuarioId: string, agora: Date) {
  const codigo = gerarCodigo();

  await db.$transaction(async (tx) => {
    await tx.pedidoDeSenha.updateMany({
      where: { usuarioId, usadoEm: null },
      data: { usadoEm: agora },
    });
    await tx.pedidoDeSenha.create({
      data: {
        usuarioId,
        codigoHash: resumoDoCodigo(codigo),
        entregueEm: agora,
        expiraEm: validadeAPartirDe(agora),
        criadoEm: agora,
      },
    });
  });

  return codigo;
}
