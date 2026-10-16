"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { destinoDaRecusa } from "@/lib/demonstracao/resposta";

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
          const resposta = await fetch(`/api/documentos/${documentoId}/ler`, { method: "POST" });
          // Na demonstração (ou sem plano) a rota recusa e diz para onde ir.
          const destino = await destinoDaRecusa(resposta);
          if (destino) {
            navegador.push(destino);
            return;
          }
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
