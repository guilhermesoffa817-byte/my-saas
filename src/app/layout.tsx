import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import "./globals.css";
import { scriptDoTema } from "@/componentes/tema";

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
  title: "Agenda Online — o sistema do seu estúdio de estética",
  description:
    "Agenda, ficha das clientes, serviços e faturamento num lugar só. Feito para quem cuida de pessoas e não quer perder tempo com papelada.",
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
