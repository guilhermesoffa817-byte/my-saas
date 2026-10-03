import type { MetadataRoute } from "next";
import { ENDERECO_DO_SITE } from "@/lib/site";

/**
 * Diz ao Google o que ele pode ler. O painel e as ações internas ficam de
 * fora: são páginas de quem já é cliente, não têm o que aparecer na busca, e
 * deixá-las abertas só gastaria o tempo que o Google reserva para o seu site.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/painel", "/painel/", "/acoes", "/acoes/"],
    },
    sitemap: `${ENDERECO_DO_SITE}/sitemap.xml`,
    host: ENDERECO_DO_SITE,
  };
}
