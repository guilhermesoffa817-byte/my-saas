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

type AreaDeTransferencia = { writeText(texto: string): Promise<void> };

type OndeCopiar = {
  clipboard?: AreaDeTransferencia | null;
  /** O `document` do navegador; só o que o plano B usa. */
  documento?: Pick<Document, "createElement" | "execCommand" | "body"> | null;
};

/**
 * Copia o texto e diz se deu certo de verdade.
 *
 * Primeiro pela área de transferência moderna. Quando ela não existe (comum em
 * navegador aberto dentro de aplicativo) ou recusa, tenta o jeito antigo: um
 * campo escondido, selecionado, e o comando "copiar". Só devolve true quando
 * um dos dois confirmou: antes o botão dizia "Copiado" mesmo sem copiar nada,
 * e a pessoa colava um Pix vazio no banco.
 */
export async function copiarTexto(
  texto: string,
  onde: OndeCopiar = {
    clipboard: typeof navigator !== "undefined" ? navigator.clipboard : null,
    documento: typeof document !== "undefined" ? document : null,
  },
): Promise<boolean> {
  if (onde.clipboard?.writeText) {
    try {
      await onde.clipboard.writeText(texto);
      return true;
    } catch {
      // Recusou (permissão, página sem foco): tenta o plano B.
    }
  }

  const documento = onde.documento;
  if (!documento?.body) return false;
  const campo = documento.createElement("textarea");
  campo.value = texto;
  campo.setAttribute("readonly", "");
  // Fora da tela, sem rolar a página nem abrir o teclado do celular.
  campo.style.position = "fixed";
  campo.style.top = "0";
  campo.style.left = "-9999px";
  campo.style.opacity = "0";
  documento.body.appendChild(campo);
  try {
    campo.select();
    campo.setSelectionRange(0, texto.length);
    return documento.execCommand("copy");
  } catch {
    return false;
  } finally {
    campo.remove();
  }
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
  const [situacao, setSituacao] = useState<"pronto" | "copiado" | "falhou">("pronto");

  async function copiar() {
    const deuCerto = await copiarTexto(texto);
    setSituacao(deuCerto ? "copiado" : "falhou");
    // O recado de falha fica mais tempo: a pessoa precisa ler o que fazer.
    setTimeout(() => setSituacao("pronto"), deuCerto ? 2500 : 8000);
  }

  return (
    <button
      type="button"
      onClick={copiar}
      aria-live="polite"
      className={`botao-suave ${situacao === "falhou" ? "flex-col gap-0.5 text-center" : ""} ${className}`}
    >
      {situacao === "copiado" ? (
        rotuloCopiado
      ) : situacao === "falhou" ? (
        <>
          <span>Não deu para copiar</span>
          <span className="text-xs font-normal">Segure o dedo no código e copie</span>
        </>
      ) : (
        rotulo
      )}
    </button>
  );
}
