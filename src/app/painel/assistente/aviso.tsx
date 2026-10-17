"use client";

import { useActionState } from "react";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Cartao } from "@/componentes/ui/cartao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { aceitarAviso, salvarRamo, type Resposta } from "./acoes";

/** O aviso do primeiro uso: a dona lê como os dados são usados e aceita antes da primeira pergunta. */
export function AvisoDeConsentimento() {
  const [resposta, enviar] = useActionState<Resposta, FormData>(aceitarAviso, null);

  return (
    <Cartao className="max-w-2xl space-y-4">
      <h2 className="font-display text-lg font-semibold text-carvao">Antes da primeira pergunta</h2>
      <div className="space-y-3 text-sm leading-relaxed text-carvao">
        <p>
          O assistente usa a inteligência artificial Claude, da Anthropic. Para responder, ele lê totais e
          indicadores do seu negócio — nunca nome, telefone, CPF ou observações dos seus clientes — e pode pesquisar
          na internet usando só o seu ramo e a sua cidade. O processamento acontece fora do Brasil.
        </p>
        <p className="text-carvao-suave">
          As respostas são sugestões e podem conter erros. Decisões sobre impostos, regime e folha continuam com o
          seu contador. As conversas sem uso há 90 dias são apagadas, e você pode apagar qualquer uma quando quiser.
        </p>
      </div>
      {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}
      <form action={enviar}>
        <BotaoEnviar enviando="Liberando...">Li e quero usar o assistente</BotaoEnviar>
      </form>
    </Cartao>
  );
}

/** O ramo do negócio, que o assistente usa para pesquisar tendências. */
export function FormularioDoRamo({ ramo, cidade }: { ramo: string | null; cidade: string | null }) {
  const [resposta, enviar] = useActionState<Resposta, FormData>(salvarRamo, null);

  return (
    <details className="rounded-2xl border border-areia-escura/70 bg-superficie p-4">
      <summary className="cursor-pointer text-sm font-semibold text-carvao">
        Ramo e cidade usados nas pesquisas: {ramo || "não informado"}
        {cidade ? `, ${cidade}` : ""}
      </summary>
      <form action={enviar} className="mt-4 space-y-3">
        <div>
          <label htmlFor="ramo" className="rotulo">
            Ramo do negócio <span className="font-normal">(opcional)</span>
          </label>
          <input
            id="ramo"
            name="ramo"
            defaultValue={ramo ?? ""}
            maxLength={60}
            placeholder="Ex.: salão de beleza, barbearia, estética"
            aria-describedby="ramo-dica"
            className="campo"
          />
          <p id="ramo-dica" className="mt-1.5 text-xs leading-relaxed text-carvao-suave">
            Só o ramo e a cidade vão para a pesquisa na internet, nunca o nome do seu negócio. A cidade é a do
            cadastro do Pix. Vale para as conversas novas.
          </p>
        </div>
        {resposta?.erro ? <Aviso tom="erro">{resposta.erro}</Aviso> : null}
        {resposta?.recado ? <Aviso tom="boa">{resposta.recado}</Aviso> : null}
        <BotaoEnviar variante="suave" enviando="Salvando...">
          Salvar ramo
        </BotaoEnviar>
      </form>
    </details>
  );
}
