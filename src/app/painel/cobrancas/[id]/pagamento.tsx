"use client";

import { useActionState } from "react";
import { Escolha, Campo } from "@/componentes/ui/campo";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { marcarComoPaga, type Resposta } from "../acoes";

export function FormularioDePagamento({
  cobrancaId,
  hoje,
}: {
  cobrancaId: string;
  hoje: string;
}) {
  const [resposta, enviar] = useActionState<Resposta, FormData>(marcarComoPaga, null);

  return (
    <form action={enviar} className="space-y-4">
      {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}
      {resposta?.recado ? <Aviso tom="boa">{resposta.recado}</Aviso> : null}

      <input type="hidden" name="id" value={cobrancaId} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Escolha
          nome="forma"
          rotulo="Como o cliente pagou"
          opcoes={[
            { valor: "pix", rotulo: "Pix" },
            { valor: "dinheiro", rotulo: "Dinheiro" },
            { valor: "cartao", rotulo: "Cartão" },
            { valor: "outra", rotulo: "De outro jeito" },
          ]}
        />
        <Campo nome="pagaEm" rotulo="Quando pagou" tipo="date" defaultValue={hoje} />
      </div>

      <BotaoEnviar className="w-full sm:w-auto" enviando="Registrando...">
        Marcar como paga
      </BotaoEnviar>
    </form>
  );
}
