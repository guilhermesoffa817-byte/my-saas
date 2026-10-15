"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Campo, Escolha } from "@/componentes/ui/campo";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { criarCobranca, type Resposta } from "../acoes";

export function FormularioDeCobranca({
  clientes,
  clienteDoHorario,
  clienteEscolhido,
  agendamentoId,
  valorSugerido,
  hoje,
}: {
  clientes: { id: string; nome: string }[];
  /** Cobrança de um horário: a cliente é a do horário e não se troca. */
  clienteDoHorario?: string;
  /** Cliente que já chega marcada na lista, vinda da ficha dela. Pode trocar. */
  clienteEscolhido?: string;
  agendamentoId?: string;
  valorSugerido: string;
  hoje: string;
}) {
  const [resposta, enviar] = useActionState<Resposta, FormData>(criarCobranca, null);
  const navegador = useRouter();

  /*
    A ação devolve o id da cobrança colado no recado, separado por barra
    vertical, porque uma ação de formulário não redireciona sozinha sem perder
    a mensagem de erro quando dá errado.
  */
  const criada = resposta?.recado?.split("|")[1];

  useEffect(() => {
    if (criada) navegador.push(`/painel/cobrancas/${criada}`);
  }, [criada, navegador]);

  return (
    <form action={enviar} className="space-y-5">
      {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}

      {agendamentoId ? (
        <input type="hidden" name="agendamentoId" value={agendamentoId} />
      ) : null}

      {clienteDoHorario ? (
        <input type="hidden" name="clienteId" value={clienteDoHorario} />
      ) : (
        <Escolha
          nome="clienteId"
          rotulo="Cliente"
          defaultValue={clienteEscolhido ?? ""}
          opcoes={[
            { valor: "", rotulo: "Escolha quem vai pagar" },
            ...clientes.map((cliente) => ({ valor: cliente.id, rotulo: cliente.nome })),
          ]}
        />
      )}

      {/*
        A dica só fala de onde veio o valor quando ele veio de algum lugar.
        Com o campo vazio, dizer "veio do preço do serviço" confunde.
      */}
      <Campo
        nome="valor"
        rotulo="Valor"
        inputMode="decimal"
        defaultValue={valorSugerido}
        placeholder="120,00"
        maxLength={15}
        dica={
          valorSugerido
            ? "Veio do valor combinado no horário. Pode mudar se cobrou outro valor."
            : "Em reais, do jeito que você escreveria: 120 ou 120,50."
        }
      />

      <Campo
        nome="vencimento"
        rotulo="Vencimento"
        tipo="date"
        defaultValue={hoje}
        dica="Até quando o cliente pode pagar."
      />

      <BotaoEnviar className="w-full sm:w-auto" enviando="Criando...">
        Criar cobrança
      </BotaoEnviar>
    </form>
  );
}
