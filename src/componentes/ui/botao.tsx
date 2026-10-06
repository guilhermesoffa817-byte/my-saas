"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useState } from "react";

type Variante = "cheio" | "suave" | "perigo" | "texto";

const classes: Record<Variante, string> = {
  cheio: "botao",
  suave: "botao-suave",
  perigo: "botao-perigo",
  texto: "botao-texto",
};

/** Botão que leva para outra tela. */
export function BotaoLink({
  href,
  children,
  variante = "cheio",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  variante?: Variante;
  className?: string;
}) {
  return (
    <Link href={href} className={`${classes[variante]} ${className}`}>
      {children}
    </Link>
  );
}

/**
 * Botão que envia um formulário. Fica desativado enquanto o servidor responde
 * e troca o texto, que é o que impede o toque duplo de criar duas cobranças.
 */
export function BotaoEnviar({
  children,
  enviando,
  variante = "cheio",
  className = "",
}: {
  children: React.ReactNode;
  enviando?: string;
  variante?: Variante;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${classes[variante]} ${className}`}
    >
      {pending ? (enviando ?? "Só um instante...") : children}
    </button>
  );
}

/** Botão de ação sem volta: pergunta antes de fazer. */
export function BotaoConfirmar({
  children,
  pergunta,
  variante = "suave",
  className = "",
}: {
  children: React.ReactNode;
  pergunta: string;
  variante?: Variante;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={(evento) => {
        if (!window.confirm(pergunta)) evento.preventDefault();
      }}
      className={`${classes[variante]} ${className}`}
    >
      {pending ? "Um segundinho..." : children}
    </button>
  );
}

export function BotaoCopiar({
  texto,
  rotulo = "Copiar",
  copiado: rotuloCopiado = "Copiado",
  className = "",
}: {
  texto: string;
  rotulo?: string;
  copiado?: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Alguns navegadores bloqueiam a área de transferência; o aviso sai mesmo assim.
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <button type="button" onClick={copiar} className={`botao-suave ${className}`}>
      {copiado ? rotuloCopiado : rotulo}
    </button>
  );
}
