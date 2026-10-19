"use client";

import { useActionState } from "react";
import { avisarPagamento } from "./acoes";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/avisos";
import type { CodigoPlano } from "@/lib/assinatura";

export function FormularioAvisoDePagamento({
  plano,
  nomeDoPlano,
  planoAvisado,
  previsao,
  contato,
}: {
  plano: CodigoPlano;
  nomeDoPlano: string;
  /** O plano do aviso que já está esperando conferência, se houver. */
  planoAvisado: CodigoPlano | null;
  /** O que este Pix faz se for confirmado hoje. Vazio quando a tela já explicou acima. */
  previsao: string | null;
  /** Os links de contato, montados no servidor. Vazio quando não há canal. */
  contato: React.ReactNode;
}) {
  const [estado, acao] = useActionState(avisarPagamento, null);

  const rotulo = !planoAvisado
    ? "Já fiz o Pix"
    : planoAvisado === plano
      ? "Avisar de novo"
      : `Trocar o aviso para ${nomeDoPlano}`;

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
      {estado?.recado ? (
        <Aviso tom="boa">
          {estado.recado}
          {contato ? <> Se demorar, fale com a gente: {contato}.</> : null}
        </Aviso>
      ) : null}

      <BotaoEnviar enviando="Avisando...">{rotulo}</BotaoEnviar>

      <p className="text-xs leading-relaxed text-carvao-suave">
        {previsao ? `${previsao} ` : null}A gente confere o pagamento e libera o acesso. Você não
        precisa enviar comprovante por aqui.
      </p>
    </form>
  );
}
