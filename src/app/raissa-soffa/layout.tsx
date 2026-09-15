import type { Metadata } from "next";
import { Manrope } from "next/font/google";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Raissa Soffa — Automação de atendimento no WhatsApp em Sinop",
  description:
    "Atendimento automático, distribuição de conversa entre atendentes e retomada de contato parado no WhatsApp, na API oficial da Meta. Assinatura mensal com preço baixo e atendimento bem feito.",
  openGraph: {
    title: "Raissa Soffa — Automação de atendimento no WhatsApp",
    description:
      "Responda na hora, divida as conversas entre os atendentes e traga de volta quem perguntou o preço e sumiu. API oficial da Meta, com atendente humano a qualquer momento.",
    locale: "pt_BR",
    type: "website",
  },
};

export default function LayoutRaissaSoffa({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className={`${manrope.className} min-h-screen bg-white text-zinc-900`}>
      {children}
    </div>
  );
}
