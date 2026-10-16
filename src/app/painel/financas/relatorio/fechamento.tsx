"use client";

import { useActionState } from "react";
import { BotaoConfirmar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { fecharMesAcao, reabrirMesAcao } from "./acoes";

/**
 * Fechar pede confirmação, porque trava o mês inteiro. A pergunta lembra o que
 * ainda está pendente: dá para fechar mesmo assim, mas a dona decide sabendo.
 */
export function FormularioFechar({
  mes,
  periodo,
  pendentes,
}: {
  mes: string;
  periodo: string;
  pendentes: number;
}) {
  const [estado, acao] = useActionState(fecharMesAcao, null);
  const pergunta =
    pendentes > 0
      ? `Ainda há ${pendentes} ${pendentes === 1 ? "pendência" : "pendências"}. Fechar ${periodo} assim mesmo? Nada com data nele poderá mudar até você reabrir.`
      : `Fechar ${periodo}? Nada com data nele poderá mudar até você reabrir.`;

  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="mes" value={mes} />
      <BotaoConfirmar pergunta={pergunta} variante="cheio">
        Fechar o mês
      </BotaoConfirmar>
      {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado?.recado ? <Aviso tom="boa">{estado.recado}</Aviso> : null}
    </form>
  );
}

export function FormularioReabrir({ mes, periodo }: { mes: string; periodo: string }) {
  const [estado, acao] = useActionState(reabrirMesAcao, null);
  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="mes" value={mes} />
      <BotaoConfirmar
        pergunta={`Reabrir ${periodo}? A reabertura fica registrada e o contador vê que o mês mudou.`}
      >
        Reabrir o mês
      </BotaoConfirmar>
      {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado?.recado ? <Aviso tom="boa">{estado.recado}</Aviso> : null}
    </form>
  );
}

