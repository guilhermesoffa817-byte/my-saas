import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Responde se o site e o banco estão de pé.
 *
 * Existe para uma visita automática por dia (.github/workflows/manter-acordado.yml):
 * o Supabase grátis pausa o banco depois de uma semana sem uso, e com o banco
 * pausado ninguém entra, cria conta ou paga. Uma consulta mínima por dia basta
 * para ele contar como usado. Não devolve nenhum dado, só "ok" ou o erro.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`select 1`;
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
