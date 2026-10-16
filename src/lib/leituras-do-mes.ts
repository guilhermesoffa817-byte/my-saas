import type { PrismaClient } from "@/generated/prisma";
import { inicioDoMes } from "@/lib/formato";

/**
 * Quantas leituras de documento o estúdio já gastou no mês corrente.
 *
 * Morava no arquivo de ações dos Documentos. Lá, por ser "use server", virava
 * uma ação pública que aceitava QUALQUER id de estúdio vindo do navegador. Aqui
 * é só uma função do servidor: quem chama já passou pela porta da tela ou da ação.
 */
export async function leiturasDoMes(db: PrismaClient, usuarioId: string, agora = new Date()) {
  return db.documento.count({
    where: {
      usuarioId,
      criadoEm: { gte: inicioDoMes(agora) },
      // Documento que nem chegou a ser lido não gasta a cota.
      situacao: { not: "falhou" },
    },
  });
}
