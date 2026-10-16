"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { sugerirClassificacao, type Resposta } from "./acoes";

/** O botão "Sugerir classificação" e o que ele respondeu. */
export function SugerirClassificacao({
  mes,
  pendentes,
  textoDasPendentes,
}: {
  mes: string;
  pendentes: number;
  textoDasPendentes: string;
}) {
  const [resposta, enviar] = useActionState<Resposta, FormData>(sugerirClassificacao, null);

  return (
    <div className="space-y-3">
      <form action={enviar} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="mes" value={mes} />
        {pendentes > 0 ? (
          <BotaoEnviar enviando="Classificando...">Sugerir classificação</BotaoEnviar>
        ) : (
          <button type="button" className="botao" disabled>
            Sugerir classificação
          </button>
        )}
        <p className="text-sm text-carvao-suave" aria-live="polite">
          {textoDasPendentes}
        </p>
      </form>
      {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}
      {resposta?.recado ? <Aviso tom="boa">{resposta.recado}</Aviso> : null}
    </div>
  );
}
