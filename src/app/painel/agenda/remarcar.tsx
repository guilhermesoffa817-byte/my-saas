"use client";

import { useActionState } from "react";
import { remarcarHorario } from "./acoes";
import { BotaoEnviar } from "@/componentes/botoes";
import { Aviso } from "@/componentes/avisos";
import { CaixaDeEncaixe } from "./encaixe";
import type { OpcaoServico } from "./formulario";

/**
 * Remarcar sem apagar e marcar de novo. Fica dentro de um <details> em cada
 * horário agendado: fechado, é só um botão; aberto, ocupa a largura do cartão,
 * que é o que cabe no celular.
 */
export function Remarcar({
  id,
  inicio,
  servicoId,
  observacoes,
  servicos,
}: {
  id: string;
  /** Valor pronto para o <input type="datetime-local">, no fuso do estúdio. */
  inicio: string;
  servicoId: string;
  observacoes: string;
  servicos: OpcaoServico[];
}) {
  const [estado, acao] = useActionState(remarcarHorario, null);

  // Mesmo cuidado do formulário de marcar: depois de um erro, os campos voltam
  // com o que a pessoa tinha escolhido, e não com o horário antigo.
  const valores = estado?.valores;
  const chave = valores ? JSON.stringify(valores) : `${inicio}|${servicoId}|${observacoes}`;

  return (
    <details className="group open:w-full">
      <summary className="botao-suave cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Remarcar</span>
        <span className="hidden group-open:inline">Fechar</span>
      </summary>

      <form
        action={acao}
        className="mt-2 space-y-3 rounded-xl border border-areia-escura bg-areia/40 p-3"
      >
        <input type="hidden" name="id" value={id} />

        <div key={chave} className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="rotulo" htmlFor={`remarcar-inicio-${id}`}>
              Novo dia e hora
            </label>
            <input
              id={`remarcar-inicio-${id}`}
              name="inicio"
              type="datetime-local"
              required
              defaultValue={valores?.inicio ?? inicio}
              className="campo"
            />
          </div>

          <div className="min-w-0">
            <label className="rotulo" htmlFor={`remarcar-servico-${id}`}>
              Serviço
            </label>
            <select
              id={`remarcar-servico-${id}`}
              name="servicoId"
              required
              defaultValue={valores?.servicoId ?? servicoId}
              aria-describedby={`remarcar-servico-${id}-dica`}
              className="campo"
            >
              {servicos.map((servico) => (
                <option key={servico.id} value={servico.id}>
                  {servico.nome} · {servico.preco} ({servico.duracaoMin} min)
                </option>
              ))}
            </select>
            <p
              id={`remarcar-servico-${id}-dica`}
              className="mt-1.5 text-xs leading-relaxed text-carvao-suave"
            >
              Mudando só o horário, o valor combinado fica. Trocando o serviço, vale
              o preço dele.
            </p>
          </div>

          <div className="min-w-0 sm:col-span-2">
            <label className="rotulo" htmlFor={`remarcar-observacoes-${id}`}>
              Observações <span className="font-normal">(opcional)</span>
            </label>
            <input
              id={`remarcar-observacoes-${id}`}
              name="observacoes"
              maxLength={500}
              defaultValue={valores?.observacoes ?? observacoes}
              className="campo"
            />
          </div>
        </div>

        {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
        {estado?.conflito ? <CaixaDeEncaixe id={`encaixe-${id}`} /> : null}
        {estado?.recado ? <Aviso tom="boa">{estado.recado}</Aviso> : null}

        <BotaoEnviar enviando="Remarcando..." className="w-full sm:w-auto">
          Salvar o novo horário
        </BotaoEnviar>
      </form>
    </details>
  );
}
