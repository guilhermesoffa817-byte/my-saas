"use client";

import { useActionState } from "react";
import { marcarHorario } from "./acoes";
import { BotaoEnviar } from "@/componentes/botoes";
import { Aviso } from "@/componentes/avisos";
import { CaixaDeEncaixe } from "./encaixe";

export type OpcaoCliente = { id: string; nome: string };
export type OpcaoServico = { id: string; nome: string; preco: string; duracaoMin: number };

export function FormularioAgendamento({
  clientes,
  servicos,
  inicioSugerido,
}: {
  clientes: OpcaoCliente[];
  servicos: OpcaoServico[];
  inicioSugerido: string;
}) {
  const [estado, acao] = useActionState(marcarHorario, null);

  /*
    Depois de cada envio o React devolve o formulário aos valores padrão. Num
    erro, o padrão passa a ser o que a pessoa tinha escolhido, e a chave nova
    faz os campos nascerem de novo com ele. Num acerto, volta tudo ao começo.
  */
  const valores = estado?.valores;
  const chave = valores ? JSON.stringify(valores) : "novo";

  return (
    <form action={acao} className="space-y-4">
      <div key={chave} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="rotulo" htmlFor="clienteId">
              Cliente
            </label>
            <select
              id="clienteId"
              name="clienteId"
              required
              className="campo"
              defaultValue={valores?.clienteId ?? ""}
            >
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

          <div className="min-w-0">
            <label className="rotulo" htmlFor="servicoId">
              Serviço
            </label>
            <select
              id="servicoId"
              name="servicoId"
              required
              className="campo"
              defaultValue={valores?.servicoId ?? ""}
            >
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

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="rotulo" htmlFor="inicio">
              Dia e hora
            </label>
            <input
              id="inicio"
              name="inicio"
              type="datetime-local"
              required
              defaultValue={valores?.inicio ?? inicioSugerido}
              className="campo"
            />
          </div>

          <div className="min-w-0">
            <label className="rotulo" htmlFor="observacoes">
              Observações <span className="font-normal">(opcional)</span>
            </label>
            <input
              id="observacoes"
              name="observacoes"
              maxLength={500}
              className="campo"
              defaultValue={valores?.observacoes ?? ""}
              placeholder="Ex.: vai trazer a filha"
            />
          </div>
        </div>
      </div>

      {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado?.conflito ? <CaixaDeEncaixe id="encaixe-novo" /> : null}
      {estado?.recado ? <Aviso tom="boa">{estado.recado}</Aviso> : null}

      <BotaoEnviar enviando="Marcando...">Marcar horário</BotaoEnviar>
    </form>
  );
}
