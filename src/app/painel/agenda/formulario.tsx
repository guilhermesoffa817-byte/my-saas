"use client";

import { startTransition, useActionState, useId, useState } from "react";
import { marcarHorario, remarcarHorario } from "./acoes";
import { BotaoEnviar } from "@/componentes/botoes";
import { Aviso } from "@/componentes/avisos";
import { Janela } from "@/componentes/ui/janela";
import { primeiroNome } from "@/lib/formato";

export type OpcaoCliente = { id: string; nome: string };
export type OpcaoServico = { id: string; nome: string; preco: string; duracaoMin: number };
export type OpcaoEquipe = { id: string; nome: string };

/*
  O React 19 limpa o formulário (form.reset()) depois de toda ação enviada
  pelo `action`, inclusive quando ela volta com erro. Aqui isso apagava
  cliente, serviço e hora junto com o "Esse horário esbarra no atendimento
  de...", e um <select> voltava para a primeira opção da lista, mostrando um
  cliente que a dona não escolheu. Por isso:
  - os campos são controlados (valor guardado em estado);
  - o envio passa por `enviarSemLimpar`: o onSubmit segura o envio do
    navegador e chama a ação dentro de startTransition. O React ainda mostra
    "Marcando..." (useFormStatus), mas não pede o reset. O `action` continua
    no <form> para funcionar mesmo sem JavaScript.
*/
function enviarSemLimpar(acao: (dados: FormData) => void) {
  return (evento: React.FormEvent<HTMLFormElement>) => {
    evento.preventDefault();
    const quemEnviou = (evento.nativeEvent as SubmitEvent).submitter;
    const dados = new FormData(evento.currentTarget, quemEnviou);
    startTransition(() => acao(dados));
  };
}

export function FormularioAgendamento({
  clientes,
  servicos,
  inicioSugerido,
  equipe = [],
}: {
  clientes: OpcaoCliente[];
  servicos: OpcaoServico[];
  /** Muda com o dia escolhido; a página põe o dia na `key` para recomeçar. */
  inicioSugerido: string;
  /** Vazia para quem trabalha sozinha: aí o campo nem aparece. */
  equipe?: OpcaoEquipe[];
}) {
  const [estado, acao] = useActionState(marcarHorario, null);
  const vazio = { clienteId: "", servicoId: "", colaboradorId: "", inicio: inicioSugerido, observacoes: "" };
  const [campos, setCampos] = useState(vazio);
  const mudar = (campo: keyof typeof vazio) => (evento: { target: { value: string } }) =>
    setCampos((atuais) => ({ ...atuais, [campo]: evento.target.value }));

  // Marcou: o formulário volta limpo para o próximo. Errou: fica como estava.
  const [respostaVista, setRespostaVista] = useState(estado);
  if (estado !== respostaVista) {
    setRespostaVista(estado);
    if (estado?.recado) setCampos(vazio);
  }

  return (
    <form action={acao} onSubmit={enviarSemLimpar(acao)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="rotulo" htmlFor="clienteId">
            Cliente
          </label>
          <select
            id="clienteId"
            name="clienteId"
            required
            className="campo"
            value={campos.clienteId}
            onChange={mudar("clienteId")}
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

        <div>
          <label className="rotulo" htmlFor="servicoId">
            Serviço
          </label>
          <select
            id="servicoId"
            name="servicoId"
            required
            className="campo"
            value={campos.servicoId}
            onChange={mudar("servicoId")}
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

      {equipe.length > 0 ? (
        <div>
          <label className="rotulo" htmlFor="colaboradorId">
            Quem atende <span className="font-normal">(opcional)</span>
          </label>
          <select
            id="colaboradorId"
            name="colaboradorId"
            className="campo"
            value={campos.colaboradorId}
            onChange={mudar("colaboradorId")}
          >
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
            className="campo"
            value={campos.inicio}
            onChange={mudar("inicio")}
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
            value={campos.observacoes}
            onChange={mudar("observacoes")}
          />
        </div>
      </div>

      {estado?.erro ? <Aviso tom="erro">{estado.erro}</Aviso> : null}
      {estado?.recado ? <Aviso tom="boa">{estado.recado}</Aviso> : null}

      <BotaoEnviar enviando="Marcando...">Marcar horário</BotaoEnviar>
    </form>
  );
}

type DadosDoHorario = {
  id: string;
  nomeCliente: string;
  /** Como o <input type="datetime-local"> espera: "2026-10-20T14:30". */
  inicio: string;
  servicoId: string;
  colaboradorId: string | null;
  servicos: OpcaoServico[];
  /** Vazia para quem não usa equipe: aí o campo não aparece e fica quem atendia. */
  equipe?: OpcaoEquipe[];
  /** Com cobrança no horário, o serviço não muda (o valor já foi combinado). */
  servicoTravado?: boolean;
};

/**
 * Remarcar um horário agendado: novo dia e hora, e também serviço e quem
 * atende. Cliente e observação ficam como estão. A conferência de choque é a
 * mesma de quem marca; dando certo, a agenda vai para o dia novo.
 *
 * Abre numa janela, e não dentro do cartão: o formulário no meio dos botões
 * empurrava e esticava as outras ações do horário.
 */
export function RemarcarHorario(dados: DadosDoHorario) {
  const [aberta, setAberta] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setAberta(true)} className="botao-suave">
        Remarcar
      </button>
      {/* Montada só quando aberta: várias janelas fechadas na lista repetiriam os ids. */}
      {aberta ? <JanelaDeRemarcar {...dados} aoFechar={() => setAberta(false)} /> : null}
    </>
  );
}

function JanelaDeRemarcar({
  id,
  nomeCliente,
  inicio,
  servicoId,
  colaboradorId,
  servicos,
  equipe = [],
  servicoTravado = false,
  aoFechar,
}: DadosDoHorario & { aoFechar: () => void }) {
  const [estado, acao, enviando] = useActionState(remarcarHorario, null);
  const [campos, setCampos] = useState({ inicio, servicoId, colaboradorId: colaboradorId ?? "" });
  const mudar = (campo: keyof typeof campos) => (evento: { target: { value: string } }) =>
    setCampos((atuais) => ({ ...atuais, [campo]: evento.target.value }));
  const base = useId();
  const idDoFormulario = `${base}-formulario`;

  return (
    <Janela
      aberta
      aoFechar={aoFechar}
      titulo={`Remarcar ${primeiroNome(nomeCliente)}`}
      texto="Escolha o novo dia e hora. Cliente e observação ficam como estão."
      confirmar={
        <button
          type="submit"
          form={idDoFormulario}
          disabled={enviando}
          aria-busy={enviando}
          className="botao w-full"
        >
          {enviando ? "Remarcando..." : "Salvar novo horário"}
        </button>
      }
    >
      <form
        id={idDoFormulario}
        action={acao}
        onSubmit={enviarSemLimpar(acao)}
        className="space-y-3 text-left"
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
            className="campo"
            value={campos.inicio}
            onChange={mudar("inicio")}
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
            disabled={servicoTravado}
            aria-describedby={servicoTravado ? `${base}-servico-dica` : undefined}
            className="campo"
            value={campos.servicoId}
            onChange={mudar("servicoId")}
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
              className="campo"
              value={campos.colaboradorId}
              onChange={mudar("colaboradorId")}
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
      </form>
    </Janela>
  );
}
