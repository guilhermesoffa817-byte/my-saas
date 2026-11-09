/**
 * Medição de visitas e anúncios: Google Analytics 4, Meta Pixel e Microsoft
 * Clarity.
 *
 * Cada ferramenta só liga quando o código dela está na Netlify:
 *   GOOGLE_ANALYTICS_ID  ex.: G-AB12CD34EF
 *   META_PIXEL_ID        ex.: 123456789012345
 *   CLARITY_ID           ex.: abcd1234ef
 * Sem nenhum, o site fica exatamente como antes: sem aviso de cookies e sem
 * script de fora. Os valores entram no build, então mudar exige publicar de novo.
 *
 * Regras de privacidade:
 * - nada carrega antes de a visitante aceitar o aviso de cookies;
 * - a medição só roda nas páginas públicas (vendas, cadastro, entrar, termos).
 *   O painel, o link de agendamento das clientes e a página do contador têm
 *   dados de terceiros e ficam de fora. A única exceção é o aviso de "conta
 *   criada" ou "demonstração aberta", que manda só o nome do evento.
 */

export type IdsDeMedicao = {
  googleAnalytics: string | null;
  metaPixel: string | null;
  clarity: string | null;
};

/**
 * Confere o formato antes de colocar o código dentro de um script. Um valor
 * errado (um espaço, o código colado pela metade) desliga só aquela ferramenta.
 */
export function idsValidos(env: Record<string, string | undefined>): IdsDeMedicao {
  const limpo = (nome: string) => (env[nome] ?? "").trim();
  const ga = limpo("GOOGLE_ANALYTICS_ID").toUpperCase();
  const pixel = limpo("META_PIXEL_ID");
  const clarity = limpo("CLARITY_ID").toLowerCase();
  return {
    googleAnalytics: /^G-[A-Z0-9]{4,20}$/.test(ga) ? ga : null,
    metaPixel: /^\d{8,20}$/.test(pixel) ? pixel : null,
    clarity: /^[a-z0-9]{6,20}$/.test(clarity) ? clarity : null,
  };
}

export function idsDeMedicao(): IdsDeMedicao {
  return idsValidos(process.env);
}

export function medicaoLigada(ids: IdsDeMedicao = idsDeMedicao()): boolean {
  return Boolean(ids.googleAnalytics || ids.metaPixel || ids.clarity);
}

/** Endereços com dados de estúdios ou de clientes deles: nunca medidos. */
const ROTAS_PRIVADAS = ["/painel", "/agendar", "/contador", "/nova-senha", "/api"];

export function rotaPublica(caminho: string): boolean {
  return !ROTAS_PRIVADAS.some((rota) => caminho === rota || caminho.startsWith(`${rota}/`));
}

/**
 * Os eventos que viram conversão nos anúncios. Chegam ao painel pelo
 * parâmetro `?bem-vindo=` depois do cadastro ou da demonstração.
 */
export const EVENTOS = {
  conta: { google: "sign_up", meta: "CompleteRegistration" },
  demonstracao: { google: "ver_demonstracao", meta: "Lead" },
} as const;

export type EventoDeMedicao = keyof typeof EVENTOS;

export const PARAMETRO_DO_EVENTO = "bem-vindo";

export function eventoDoParametro(valor: string | null): EventoDeMedicao | null {
  return valor === "conta" || valor === "demonstracao" ? valor : null;
}

/** Onde fica guardada a resposta ao aviso de cookies, no próprio navegador. */
export const CHAVE_DO_CONSENTIMENTO = "bossa_medicao";
