/**
 * Mantém o banco acordado: o Supabase grátis pausa depois de uma semana sem
 * uso, e com ele pausado ninguém entra, cria conta ou paga.
 *
 * Roda no próprio Netlify todo dia às 8h17 de Brasília (11h17 UTC) e visita
 * /api/saude, que faz uma consulta mínima no banco. Não depende do GitHub
 * Actions (o .github/workflows/manter-acordado.yml faz o mesmo, se estiver ligado).
 */
export default async function manterAcordado() {
  const site = process.env.URL ?? "https://agendaonlinecontabilidade.netlify.app";
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const resposta = await fetch(`${site}/api/saude`, { signal: AbortSignal.timeout(25_000) });
      if (resposta.ok) return new Response("ok");
    } catch {
      // Tenta de novo: o banco pode estar acordando.
    }
    await new Promise((pronto) => setTimeout(pronto, 5_000));
  }
  console.error("O site ou o banco não respondeu. Confira se o projeto do Supabase está ativo.");
  return new Response("sem resposta", { status: 503 });
}

export const config = { schedule: "17 11 * * *" };
