"use client";

import { useEffect, useRef } from "react";

/**
 * Janela de confirmação. Entra no lugar do `window.confirm`, que no celular
 * aparece colado no topo do navegador, com a letra do sistema, e não parece
 * parte do Bossa.
 *
 * Usa o <dialog> do próprio navegador, então a tecla Esc, o foco preso dentro
 * da janela e o fundo escurecido vêm de graça e funcionam com leitor de tela.
 */
export function Janela({
  aberta,
  titulo,
  texto,
  confirmar,
  perigo = false,
  aoFechar,
  children,
}: {
  aberta: boolean;
  titulo: string;
  texto?: string;
  confirmar: React.ReactNode;
  perigo?: boolean;
  aoFechar: () => void;
  children?: React.ReactNode;
}) {
  const referencia = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const janela = referencia.current;
    if (!janela) return;
    if (aberta && !janela.open) janela.showModal();
    if (!aberta && janela.open) janela.close();
  }, [aberta]);

  return (
    <dialog
      ref={referencia}
      onClose={aoFechar}
      aria-labelledby="titulo-da-janela"
      className="w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-areia-escura bg-superficie p-0 text-carvao backdrop:bg-carvao/40 backdrop:backdrop-blur-sm"
    >
      <div className="p-5 sm:p-6">
        <h2 id="titulo-da-janela" className="font-display text-lg font-semibold text-carvao">
          {titulo}
        </h2>
        {texto ? (
          <p className="mt-2 text-sm leading-relaxed text-carvao-suave">{texto}</p>
        ) : null}

        {children ? <div className="mt-4">{children}</div> : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={aoFechar} className="botao-suave">
            Voltar
          </button>
          <span className={perigo ? "[&_button]:bg-rose-600 [&_button]:hover:bg-rose-700" : ""}>
            {confirmar}
          </span>
        </div>
      </div>
    </dialog>
  );
}
