"use client";

import { useActionState, useState } from "react";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { NATUREZAS, ROTULO_DA_NATUREZA, type Natureza, type OrigemDaNatureza } from "@/lib/custos/calculo";
import { corrigirNatureza, type Resposta } from "./acoes";

type Escolha = Natureza | "nenhuma";

/**
 * O seletor de cada despesa. Não salva sozinho ao trocar a opção: quem navega
 * pelo teclado passaria por todas as naturezas no caminho. Salva no botão.
 *
 * Quando a classificação veio de regra ou da IA, "Confirmar" passa a escolha
 * para o nome da dona, e a partir daí nada automático mexe nela.
 */
export function FormularioDaNatureza({
  id,
  descricao,
  natureza,
  origem,
}: {
  id: string;
  descricao: string;
  natureza: Natureza | null;
  origem: OrigemDaNatureza | null;
}) {
  const [resposta, enviar] = useActionState<Resposta, FormData>(corrigirNatureza, null);
  const atual: Escolha = natureza ?? "nenhuma";
  const [escolha, setEscolha] = useState<Escolha>(atual);
  const mudou = escolha !== atual;
  const podeConfirmar = !mudou && natureza !== null && origem !== "voce";

  return (
    <form action={enviar} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`natureza-${id}`}>
        Classificação de {descricao}
      </label>
      <select
        id={`natureza-${id}`}
        name="natureza"
        value={escolha}
        onChange={(evento) => setEscolha(evento.target.value as Escolha)}
        className="campo min-h-11 w-auto flex-1 py-2 sm:flex-none"
      >
        <option value="nenhuma">Sem classificação</option>
        {NATUREZAS.map((opcao) => (
          <option key={opcao} value={opcao}>
            {ROTULO_DA_NATUREZA[opcao]}
          </option>
        ))}
      </select>
      {mudou ? (
        <BotaoEnviar variante="suave" enviando="Salvando...">
          Salvar
        </BotaoEnviar>
      ) : podeConfirmar ? (
        <BotaoEnviar variante="texto" enviando="Salvando...">
          Confirmar
        </BotaoEnviar>
      ) : null}
      {resposta?.erro ? (
        <p role="alert" className="w-full text-xs text-rose-700 dark:text-rose-300">
          {resposta.erro}
        </p>
      ) : null}
    </form>
  );
}
