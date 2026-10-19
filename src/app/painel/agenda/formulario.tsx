"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { marcarHorario, remarcarHorario } from "./acoes";
import { BotaoEnviar } from "@/componentes/botoes";
import { Aviso } from "@/componentes/avisos";

export type OpcaoCliente = { id: string; nome: string };
export type OpcaoServico = { id: string; nome: string; preco: string; duracaoMin: number };
export type OpcaoEquipe = { id: string; nome: string };

export function FormularioAgendamento({
  clientes,
  servicos,
  inicioSugerido,
  equipe = [],
}: {
  clientes: OpcaoCliente[];
  servicos: OpcaoServico[];
  inicioSugerido: string;
  /** Vazia para quem trabalha sozinha: aí o campo nem aparece. */
  equipe?: OpcaoEquipe[];
}) {
  const [estado, acao] = useActionState(marcarHorario, null);
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.recado) formulario.current?.reset();
  }, [estado]);

  return (
    <form ref={formulario} action={acao} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="clienteId">
            Cliente
          </label>
          <select id="clienteId" name="clienteId" required className="campo" defaultValue="">
            <option value="" disabled>
              Escolha quem será atendido
            </option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.nome}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="rotulo" htmlFor="servicoId">
            Serviço
          </label>
          <select id="servicoId" name="servicoId" required className="campo" defaultValue="">
            <option value="" disabled>
              Escolha o serviço
            </option>
            {servicos.map((servico) => (
              <option key={servico.id} value={servico.id}>
                {servico.nome} · {servico.preco} ({servico.duracaoMin} min)
              </option>
            ))}
          </select>
        </div>
      </div>

      {equipe.length > 0 ? (
        <div>
          <label className="rotulo" htmlFor="colaboradorId">
            Quem atende <span className="font-normal">(opcional)</span>
          </label>
          <select id="colaboradorId" name="colaboradorId" className="campo" defaultValue="">
            <option value="">Eu mesma</option>
            {equipe.map((pessoa) => (
              <option key={pessoa.id} value={pessoa.id}>
                {pessoa.nome}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs leading-relaxed text-carvao-suave">
            Os atendimentos concluídos de cada pessoa formam a base da comissão na Equipe.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="inicio">
            Dia e hora
          </label>
          <input
            id="inicio"
            name="inicio"
            type="datetime-local"
            required
            defaultValue={inicioSugerido}
            className="campo"
          />
        </div>

        <div>
          <label className="rotulo" htmlFor="observacoes">
            Observações <span className="font-normal">(opcional)</span>
          </label>
          <input
            id="observacoes"
            name="observacoes"
            className="campo"
            placeholder="Vai trazer a irmã, quer encaixe às 15h..."
          />
        </div>
      </div>

      {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado?.recado ? <Aviso tom="boa">{estado.recado}</Aviso> : null}

      <BotaoEnviar enviando="Marcando...">Marcar horário</BotaoEnviar>
    </form>
  );
}

/**
 * Remarcar um horário agendado: novo dia e hora, e também serviço e quem
 * atende. Cliente e observação ficam como estão. A conferência de choque é a
 * mesma de quem marca; dando certo, a agenda vai para o dia novo.
 */
export function RemarcarHorario({
  id,
  inicio,
  servicoId,
  colaboradorId,
  servicos,
  equipe = [],
  servicoTravado = false,
}: {
  id: string;
  /** Como o <input type="datetime-local"> espera: "2026-10-20T14:30". */
  inicio: string;
  servicoId: string;
  colaboradorId: string | null;
  servicos: OpcaoServico[];
  /** Vazia para quem não usa equipe: aí o campo não aparece e fica quem atendia. */
  equipe?: OpcaoEquipe[];
  /** Com cobrança no horário, o serviço não muda (o valor já foi combinado). */
  servicoTravado?: boolean;
}) {
  const [estado, acao] = useActionState(remarcarHorario, null);
  // Vários horários na mesma tela: cada formulário precisa de ids próprios.
  const base = useId();

  return (
    <details className="w-full sm:w-auto">
      <summary className="botao-suave w-full cursor-pointer list-none">Remarcar</summary>
      <form
        action={acao}
        className="mt-3 space-y-3 rounded-xl border border-areia-escura bg-areia/40 p-3 text-left sm:w-80"
      >
        <input type="hidden" name="id" value={id} />

        <div>
          <label className="rotulo" htmlFor={`${base}-inicio`}>
            Novo dia e hora
          </label>
          <input
            id={`${base}-inicio`}
            name="inicio"
            type="datetime-local"
            required
            defaultValue={inicio}
            className="campo"
          />
        </div>

        <div>
          <label className="rotulo" htmlFor={`${base}-servico`}>
            Serviço
          </label>
          <select
            id={`${base}-servico`}
            name="servicoId"
            required
            defaultValue={servicoId}
            disabled={servicoTravado}
            aria-describedby={servicoTravado ? `${base}-servico-dica` : undefined}
            className="campo"
          >
            {servicos.map((servico) => (
              <option key={servico.id} value={servico.id}>
                {servico.nome} · {servico.preco} ({servico.duracaoMin} min)
              </option>
            ))}
          </select>
          {servicoTravado ? (
            <>
              {/* Campo desligado não vai no envio: o serviço atual vai por aqui. */}
              <input type="hidden" name="servicoId" value={servicoId} />
              <p id={`${base}-servico-dica`} className="mt-1.5 text-xs leading-relaxed text-carvao-suave">
                O serviço fica como está porque esse horário já tem cobrança.
              </p>
            </>
          ) : null}
        </div>

        {equipe.length > 0 ? (
          <div>
            <label className="rotulo" htmlFor={`${base}-quem`}>
              Quem atende
            </label>
            <select
              id={`${base}-quem`}
              name="colaboradorId"
              defaultValue={colaboradorId ?? ""}
              className="campo"
            >
              <option value="">Eu mesma</option>
              {equipe.map((pessoa) => (
                <option key={pessoa.id} value={pessoa.id}>
                  {pessoa.nome}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
        {estado?.recado ? <Aviso tom="boa">{estado.recado}</Aviso> : null}

        <BotaoEnviar className="w-full" enviando="Remarcando...">
          Salvar novo horário
        </BotaoEnviar>
      </form>
    </details>
  );
}
