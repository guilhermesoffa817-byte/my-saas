"use client";

import { useActionState } from "react";
import { Campo } from "@/componentes/ui/campo";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { marcarComoPago, type Resposta } from "./acoes";

export function BotaoPagar({
  id,
  hoje,
  rotulo,
}: {
  id: string;
  hoje: string;
  rotulo: string;
}) {
  const [resposta, enviar] = useActionState<Resposta, FormData>(marcarComoPago, null);

  return (
    <div className="w-full">
      {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}
      <details>
        <summary className="botao-suave w-full cursor-pointer list-none sm:w-auto">
          {rotulo}
        </summary>
        <form action={enviar} className="mt-3 space-y-3 rounded-xl border border-areia-escura bg-areia/40 p-3">
          <input type="hidden" name="id" value={id} />
          <Campo
            nome="pagoEm"
            idDoCampo={`pagoEm-${id}`}
            rotulo="Quando"
            tipo="date"
            defaultValue={hoje}
          />
          <BotaoEnviar className="w-full" enviando="Registrando...">
            Confirmar
          </BotaoEnviar>
        </form>
      </details>
    </div>
  );
}
