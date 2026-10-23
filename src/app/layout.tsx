import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { scriptDoTema } from "@/componentes/script-do-tema";
import {
  DESCRICAO_CURTA,
  ENDERECO_DO_SITE,
  NOME_DO_PRODUTO,
  PALAVRAS_CHAVE,
  TITULO_PADRAO,
} from "@/lib/site";

const display = Plus_Jakarta_Sans({
  variable: "--fonte-display",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const texto = Inter({
  variable: "--fonte-texto",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  // Base de todos os endereços absolutos que o Next gera (capa, canônico, sitemap).
  metadataBase: new URL(ENDERECO_DO_SITE),

  title: {
    default: TITULO_PADRAO,
    // As outras páginas viram "Agenda · Bossa" e por aí vai.
    template: `%s · ${NOME_DO_PRODUTO}`,
  },
  description: DESCRICAO_CURTA,
  keywords: PALAVRAS_CHAVE,
  applicationName: NOME_DO_PRODUTO,
  category: "business",
  /*
    Sem canônico nem robots aqui: o que fica no layout vale para todas as
    páginas, e um canônico "/" herdado diz ao Google que /criar-conta, /entrar
    e até a página de erro são cópias da inicial. Cada página pública diz o
    próprio endereço; a de erro ganha o "noindex" que o Next põe sozinho.
  */

  /*
    O cartão que aparece quando alguém manda o link no WhatsApp ou no
    Instagram. Título e descrição ficam de fora de propósito: o Next copia os
    da página aberta, então o cartão dos Termos diz "Termos de uso", e não o
    título da página inicial.
  */
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: NOME_DO_PRODUTO,
    images: [
      {
        url: "/capa.png",
        width: 1200,
        height: 630,
        alt: `${NOME_DO_PRODUTO}: a semana organizada e o faturamento do mês somado.`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/capa.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${texto.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Aplica o tema salvo antes da primeira pintura, para não piscar. */}
        <script dangerouslySetInnerHTML={{ __html: scriptDoTema }} />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
