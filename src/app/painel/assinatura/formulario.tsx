"use client";

import { useActionState } from "react";
import { avisarPagamento } from "./acoes";
import { BotaoEnviar } from "@/componentes/botoes";
import { Aviso } from "@/componentes/avisos";
import type { CodigoPlano } from "@/lib/assinatura";

export function FormularioAvisoDePagamento({
  jaAvisou,
  plano,
  dias,
}: {
  jaAvisou: boolean;
  plano: CodigoPlano;
  dias: number;
}) {
  const [estado, acao] = useActionState(avisarPagamento, null);

  return (
    <form action={acao} className="space-y-3">
      {/* Diz ao servidor qual plano foi pago, para liberar os dias certos. */}
      <input type="hidden" name="plano" value={plano} />

      <div>
        <label className="rotulo" htmlFor="observacao">
          Quer deixar um recado? <span className="font-normal">(opcional)</span>
        </label>
        <input
          id="observacao"
          name="observacao"
          className="campo"
          placeholder="Paguei pelo banco X às 14h, em nome de..."
          maxLength={300}
        />
      </div>

      {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado?.recado ? <Aviso tom="boa">{estado.recado}</Aviso> : null}

      <BotaoEnviar enviando="Avisando...">
        {jaAvisou ? "Avisar de novo" : "Já fiz o Pix"}
      </BotaoEnviar>

      <p className="text-xs leading-relaxed text-carvao-suave">
        A gente confere o pagamento e libera seu acesso por mais {dias} dias. Você não
        precisa enviar comprovante por aqui.
      </p>
    </form>
  );
}
