"use client";

import { useActionState, useState } from "react";
import { Campo } from "@/componentes/ui/campo";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { Janela } from "@/componentes/ui/janela";
import type { Vinculo } from "@/lib/equipe";
import { desligarColaboradorAcao, removerColaboradorAcao, type Resposta } from "./acoes";

/** Registrar o último dia. O cadastro e os pagamentos continuam na tela. */
export function Desligar({
  id,
  nome,
  vinculo,
  inicio,
  hoje,
}: {
  id: string;
  nome: string;
  vinculo: Vinculo;
  inicio: string;
  hoje: string;
}) {
  const [resposta, enviar] = useActionState<Resposta, FormData>(desligarColaboradorAcao, null);
  const empregada = vinculo === "clt" || vinculo === "estagio";

  return (
    <details className="w-full sm:w-auto">
      <summary className="botao-suave w-full cursor-pointer list-none">Desligar</summary>
      <form
        action={enviar}
        className="mt-3 space-y-3 rounded-xl border border-areia-escura bg-areia/40 p-3 sm:w-80"
      >
        <input type="hidden" name="id" value={id} />
        {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}
        <Campo
          nome="fim"
          idDoCampo={`fim-${id}`}
          rotulo={`Último dia de ${nome.split(" ")[0]}`}
          tipo="date"
          min={inicio}
          defaultValue={inicio > hoje ? inicio : hoje}
        />
        <p className="text-xs leading-relaxed text-carvao-suave">
          {empregada
            ? "Aviso prévio, rescisão e baixa na carteira ou no termo de estágio são com o contador. Quando ele mandar os valores, registre na aba Pagamentos."
            : "O fim do contrato segue o que foi assinado. Se houver valor a acertar, registre na aba Pagamentos."}
        </p>
        <BotaoEnviar className="w-full" enviando="Registrando...">
          Registrar desligamento
        </BotaoEnviar>
      </form>
    </details>
  );
}

/**
 * Remover com a explicação inteira antes do toque. O que acontece depende de
 * já haver pagamento registrado, e a pessoa precisa saber disso antes.
 */
export function Remover({ id, nome }: { id: string; nome: string }) {
  const [aberta, setAberta] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        className="botao-suave text-rose-700 hover:border-rose-300 hover:text-rose-700 dark:text-rose-300"
      >
        Remover
      </button>
      {/* Montada só quando aberta: várias janelas fechadas na lista repetiriam o id do título. */}
      {aberta ? (
        <Janela
          aberta
          aoFechar={() => setAberta(false)}
          titulo={`Remover ${nome}?`}
          perigo
          confirmar={
            <form action={removerColaboradorAcao}>
              <input type="hidden" name="id" value={id} />
              <BotaoEnviar enviando="Removendo..." className="w-full">
                Remover
              </BotaoEnviar>
            </form>
          }
        >
          <div className="space-y-2 text-sm leading-relaxed text-carvao-suave">
            <p>
              Se ainda não há pagamento registrado, o cadastro some por completo, com as ausências.
            </p>
            <p>
              Se já há pagamento, os valores continuam nas Finanças para o contador, mas sem
              identificar a pessoa: o nome vira “Ex-colaborador” (também na descrição dos
              lançamentos) e são apagados CPF, Pix, contato, observações e ausências.
            </p>
            <p>Os horários que ela atendeu continuam na agenda, sem o nome dela.</p>
            <p className="font-semibold text-carvao">Não dá para desfazer.</p>
          </div>
        </Janela>
      ) : null}
    </>
  );
}
