import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
    A página do contador abre só com o código secreto no endereço. Nada dela
    pode ficar guardado em cache no caminho, aparecer no Google ou vazar o
    endereço (com o código) para outro site num clique.
  */
  async headers() {
    return [
      {
        source: "/contador/:caminho*",
        headers: [
          { key: "Cache-Control", value: "private, no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
