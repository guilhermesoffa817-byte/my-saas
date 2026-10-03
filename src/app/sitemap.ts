import type { MetadataRoute } from "next";
import { ENDERECO_DO_SITE } from "@/lib/site";

/**
 * A lista de páginas que o Google deve indexar. São as três públicas; o resto
 * fica atrás do login. O sitemap é o que acelera o Google a achar o site novo,
 * em vez de esperar ele tropeçar por acaso.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const agora = new Date();

  return [
    {
      url: `${ENDERECO_DO_SITE}/`,
      lastModified: agora,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${ENDERECO_DO_SITE}/criar-conta`,
      lastModified: agora,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${ENDERECO_DO_SITE}/entrar`,
      lastModified: agora,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
