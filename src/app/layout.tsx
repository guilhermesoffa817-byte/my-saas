import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { scriptDoTema } from "@/componentes/tema";
import {
  DESCRICAO_CURTA,
  ENDERECO_DO_SITE,
  NOME_DO_PRODUTO,
  PALAVRAS_CHAVE,
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
    default: "Agenda Online · sistema de agendamento para estúdios",
    // As outras páginas viram "Agenda · Agenda Online" e por aí vai.
    template: "%s · Agenda Online",
  },
  description: DESCRICAO_CURTA,
  keywords: PALAVRAS_CHAVE,
  applicationName: NOME_DO_PRODUTO,
  category: "business",
  alternates: { canonical: "/" },

  // Como o Google e os buscadores devem tratar o site.
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },

  // O cartão que aparece quando alguém manda o link no WhatsApp ou no Instagram.
  openGraph: {
    type: "website",
    locale: "pt_BR",
    url: ENDERECO_DO_SITE,
    siteName: NOME_DO_PRODUTO,
    title: "Agenda Online · sistema de agendamento para estúdios",
    description: DESCRICAO_CURTA,
    images: [
      {
        url: "/capa.png",
        width: 1200,
        height: 630,
        alt: "Agenda Online: a semana organizada e o faturamento do mês somado.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Agenda Online · sistema de agendamento para estúdios",
    description: DESCRICAO_CURTA,
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
