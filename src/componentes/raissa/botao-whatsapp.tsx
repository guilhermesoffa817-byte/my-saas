"use client";

import type { ReactNode } from "react";
import { LINK_WHATSAPP } from "./dados";
import { IconeWhatsApp } from "./icones";

type JanelaComDataLayer = Window & {
  dataLayer?: Record<string, unknown>[];
};

/** Registra o clique para quem já usa uma tag de medição no site. Sem tag, não faz nada. */
function registrarClique(origem: string) {
  if (typeof window === "undefined") return;

  const janela = window as JanelaComDataLayer;
  janela.dataLayer = janela.dataLayer ?? [];
  janela.dataLayer.push({
    event: "clique_whatsapp",
    origem,
    destino: LINK_WHATSAPP,
  });
}

type PropsBotao = {
  children: ReactNode;
  /** De qual parte da página veio o clique (hero, planos, rodapé...). */
  origem: string;
  tamanho?: "grande" | "medio";
  variante?: "verde" | "branco" | "contorno";
  className?: string;
};

const TAMANHOS = {
  grande: "px-7 py-4 text-base sm:text-lg gap-3",
  medio: "px-5 py-3 text-sm gap-2",
} as const;

const VARIANTES = {
  verde:
    "bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/25 hover:bg-emerald-400 focus-visible:outline-emerald-400",
  branco:
    "bg-white text-zinc-900 shadow-lg shadow-zinc-900/10 hover:bg-zinc-100 focus-visible:outline-white",
  contorno:
    "border border-emerald-600/30 bg-emerald-50 text-emerald-800 hover:border-emerald-600/60 hover:bg-emerald-100 focus-visible:outline-emerald-600",
} as const;

export function BotaoWhatsApp({
  children,
  origem,
  tamanho = "grande",
  variante = "verde",
  className = "",
}: PropsBotao) {
  return (
    <a
      href={LINK_WHATSAPP}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => registrarClique(origem)}
      className={`inline-flex items-center justify-center rounded-full font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] ${TAMANHOS[tamanho]} ${VARIANTES[variante]} ${className}`}
    >
      <IconeWhatsApp className={tamanho === "grande" ? "h-6 w-6" : "h-5 w-5"} />
      <span>{children}</span>
    </a>
  );
}
