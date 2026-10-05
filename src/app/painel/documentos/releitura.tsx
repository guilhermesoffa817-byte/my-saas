"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Tenta ler de novo um documento que parou no meio ou falhou. */
export function BotaoReler({ documentoId }: { documentoId: string }) {
  const [tentando, setTentando] = useState(false);
  const navegador = useRouter();

  return (
    <button
      type="button"
      disabled={tentando}
      onClick={async () => {
        setTentando(true);
        try {
          await fetch(`/api/documentos/${documentoId}/ler`, { method: "POST" });
        } catch {
          // A tela mostra a situação de qualquer jeito depois do refresh.
        }
        navegador.refresh();
        setTentando(false);
      }}
      className="botao-suave"
    >
      {tentando ? "Lendo..." : "Tentar de novo"}
    </button>
  );
}
