/**
 * Lido pelas telas que chamam as rotas de API (assistente, leitura de
 * documento). Quando a rota recusa por demonstração, assinatura vencida ou
 * plano, ela manda um `destino`; a tela leva a pessoa para lá em vez de
 * mostrar um erro. Roda no navegador: nada de servidor aqui.
 */
export async function destinoDaRecusa(resposta: Response): Promise<string | null> {
  if (resposta.status !== 401 && resposta.status !== 403) return null;
  try {
    const corpo = (await resposta.clone().json()) as { destino?: unknown };
    // Só caminho interno: um destino vindo de fora nunca vira navegação.
    return typeof corpo.destino === "string" && corpo.destino.startsWith("/") && !corpo.destino.startsWith("//")
      ? corpo.destino
      : null;
  } catch {
    return null;
  }
}
