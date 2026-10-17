"use client";

import { useActionState, useEffect, useRef } from "react";
import { marcarHorario } from "./acoes";
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
