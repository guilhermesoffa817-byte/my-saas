import type { Metadata } from "next";
import { Fraunces, Nunito } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  variable: "--fonte-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const texto = Nunito({
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
    <html lang="pt-BR" className={`${display.variable} ${texto.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}
