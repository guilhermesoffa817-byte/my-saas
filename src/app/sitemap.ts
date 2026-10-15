import type { MetadataRoute } from "next";
import { ENDERECO_DO_SITE, PAGINAS_PUBLICAS } from "@/lib/site";

/**
 * A lista de páginas que o Google deve indexar: as públicas, que moram em
 * lib/site.ts; o resto fica atrás do login. O sitemap é o que acelera o Google
 * a achar o site novo, em vez de esperar ele tropeçar por acaso.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const agora = new Date();

  return PAGINAS_PUBLICAS.map((pagina) => ({
    url: `${ENDERECO_DO_SITE}${pagina.caminho}`,
    lastModified: agora,
    changeFrequency: pagina.frequencia,
    priority: pagina.prioridade,
  }));
}
