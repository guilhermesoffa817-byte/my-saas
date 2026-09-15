"use client";

import { useFormStatus } from "react-dom";
import { useState } from "react";

export function BotaoEnviar({
  children,
  enviando,
  variante = "cheio",
  className = "",
}: {
  children: React.ReactNode;
  enviando?: string;
  variante?: "cheio" | "suave";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const base = variante === "cheio" ? "botao" : "botao-suave";

  return (
    <button type="submit" disabled={pending} className={`${base} ${className}`}>
      {pending ? (enviando ?? "Só um instante...") : children}
    </button>
  );
}

export function BotaoCopiar({
  texto,
  rotulo = "Copiar",
  className = "",
}: {
  texto: string;
  rotulo?: string;
  className?: string;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      // Alguns navegadores bloqueiam a área de transferência: seguimos com o aviso mesmo assim.
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  }

  return (
    <button type="button" onClick={copiar} className={`botao-suave ${className}`}>
      {copiado ? "Copiado, pode colar no banco" : rotulo}
    </button>
  );
}

export function BotaoConfirmar({
  children,
  pergunta,
  variante = "suave",
  className = "",
}: {
  children: React.ReactNode;
  pergunta: string;
  variante?: "cheio" | "suave";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const base = variante === "cheio" ? "botao" : "botao-suave";

  return (
    <button
      type="submit"
      disabled={pending}
      onClick={(evento) => {
        if (!window.confirm(pergunta)) evento.preventDefault();
      }}
      className={`${base} ${className}`}
    >
      {pending ? "Um segundinho..." : children}
    </button>
  );
}
