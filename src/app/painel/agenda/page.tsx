import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import { agoraDoPedido } from "@/lib/agora";
import { Aviso, Etiqueta, Vazio, type Tom } from "@/componentes/avisos";
import { BotaoConfirmar, BotaoEnviar } from "@/componentes/botoes";
import {
  ROTULO_DA_SITUACAO,
  SITUACOES_QUE_OCUPAM,
  situacaoValida,
  valorDoAtendimento,
  type SituacaoDoAtendimento,
} from "@/lib/atendimento";
import {
  dataPorExtenso,
  deDataLocal,
  diaDaSemana,
  inicioDaSemana,
  emReais,
  hora,
  paraDataLocal,
  paraHorarioLocal,
  somarDias,
  telefoneBonito,
} from "@/lib/formato";
import { mensagemDeConfirmacao } from "@/lib/confirmacao";
import { linkDoWhatsApp, telefoneParaWhatsApp } from "@/lib/telefone";
import { FormularioAgendamento, type OpcaoServico } from "./formulario";
import { DockDaSemana, type DiaDaSemana } from "./semana";
import { Remarcar } from "./remarcar";
import { excluirAgendamento, mudarStatus } from "./acoes";

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

const TOM_DA_SITUACAO: Record<SituacaoDoAtendimento, Tom> = {
  agendado: "calma",
  concluido: "boa",
  faltou: "atencao",
  cancelado: "erro",
};

/** Falta e cancelamento não ocupam a cadeira nem entram no previsto do dia. */
function ocupa(status: string) {
  return (SITUACOES_QUE_OCUPAM as string[]).includes(status);
}

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const { usuario } = await exigirAcesso();
  const { dia } = await searchParams;

  const agora = agoraDoPedido();
  const diaEscolhido = (dia ? deDataLocal(dia) : null) ?? deDataLocal(paraDataLocal(agora))!;
  const diaSeguinte = somarDias(diaEscolhido, 1);
  const chaveDoDia = paraDataLocal(diaEscolhido);
  const segunda = inicioDaSemana(diaEscolhido);
  const fimDaSemana = somarDias(segunda, 7);

  const [clientes, servicos, daSemana] = await Promise.all([
    prisma.cliente.findMany({
      // Cliente arquivado não aparece para marcar horário novo.
      where: { usuarioId: usuario.id, arquivadoEm: null },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    prisma.servico.findMany({
      where: { usuarioId: usuario.id, ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, precoCentavos: true, duracaoMin: true },
    }),
    prisma.agendamento.findMany({
      where: {
        usuarioId: usuario.id,
        inicio: { gte: segunda, lt: fimDaSemana },
      },
      select: {
        id: true,
        inicio: true,
        status: true,
        observacoes: true,
        servicoId: true,
        valorCentavos: true,
        confirmacaoEnviadaEm: true,
        cliente: { select: { nome: true, telefone: true, arquivadoEm: true } },
        servico: { select: { nome: true, precoCentavos: true, duracaoMin: true } },
        /* Para saber se o horário já foi cobrado e se a cobrança está de pé. */
        cobrancas: { select: { id: true, situacao: true, valorCentavos: true } },
      },
      orderBy: { inicio: "asc" },
    }),
  ]);

  const agendamentosDoDia = daSemana.filter(
    (item) => item.inicio >= diaEscolhido && item.inicio < diaSeguinte,
  );
  const valendo = agendamentosDoDia.filter((item) => ocupa(item.status));

  const dias: DiaDaSemana[] = Array.from({ length: 7 }, (_, posicao) => {
    const data = somarDias(segunda, posicao);
    const chave = paraDataLocal(data);
    return {
      data,
      chave,
      atendimentos: daSemana.filter(
        (item) => paraDataLocal(item.inicio) === chave && ocupa(item.status),
      ).length,
    };
  });

  const opcoesDeServico: OpcaoServico[] = servicos.map((servico) => ({
    id: servico.id,
    nome: servico.nome,
    preco: emReais(servico.precoCentavos),
    duracaoMin: servico.duracaoMin,
  }));

  const podeAgendar = clientes.length > 0 && servicos.length > 0;
  const sugestao = paraHorarioLocal(
    new Date(diaEscolhido.getTime() + 9 * 60 * 60 * 1000),
  );
  const previsto = valendo.reduce((soma, item) => soma + valorDoAtendimento(item), 0);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-semibold text-carvao sm:text-3xl">Sua agenda</h1>
        <p className="mt-2 text-carvao-suave">
          Escolha o dia, marque os horários e vá marcando como concluído conforme
          os clientes forem saindo.
        </p>
      </section>

      <section className="cartao p-4 sm:p-6">
        <h2 className="font-display text-xl font-semibold text-carvao">Marcar um horário</h2>

        {podeAgendar ? (
          <div className="mt-5">
            <FormularioAgendamento
              inicioSugerido={sugestao}
              clientes={clientes}
              servicos={opcoesDeServico}
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <Aviso tom="atencao">
              Antes de marcar o primeiro horário, precisamos de{" "}
              {clientes.length === 0 ? "pelo menos um cliente" : null}
              {clientes.length === 0 && servicos.length === 0 ? " e " : null}
              {servicos.length === 0 ? "pelo menos um serviço ativo" : null} no cadastro.
            </Aviso>
            <div className="flex flex-wrap gap-2">
              {clientes.length === 0 ? (
                <Link href="/painel/clientes" className="botao-suave">
                  Cadastrar cliente
                </Link>
              ) : null}
              {servicos.length === 0 ? (
                <Link href="/painel/servicos" className="botao-suave">
                  Cadastrar serviço
                </Link>
              ) : null}
            </div>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-carvao">
              {diaDaSemana(diaEscolhido).replace(/^./, (l) => l.toUpperCase())},{" "}
              {dataPorExtenso(diaEscolhido)}
            </h2>
            <p className="text-sm text-carvao-suave">
              {agendamentosDoDia.length === 0
                ? "Nenhum atendimento nesse dia."
                : valendo.length === 0
                  ? "Os horários desse dia foram cancelados ou tiveram falta."
                  : `${valendo.length} ${valendo.length === 1 ? "atendimento" : "atendimentos"} · ${emReais(previsto)} previstos`}
            </p>
          </div>

          <form className="flex gap-2">
            <input
              type="date"
              name="dia"
              defaultValue={chaveDoDia}
              className="campo py-2"
              aria-label="Escolher outro dia"
            />
            <button type="submit" className="botao-suave">
              Ver
            </button>
          </form>
        </div>

        <DockDaSemana
          dias={dias}
          selecionado={chaveDoDia}
          hoje={paraDataLocal(agora)}
        />

        {agendamentosDoDia.length === 0 ? (
          <Vazio
            titulo="Dia livre por aqui"
            texto="Aproveite para organizar o estúdio, ou marque um horário no formulário acima."
          />
        ) : (
          <ul className="space-y-3">
            {agendamentosDoDia.map((item) => {
              const situacao: SituacaoDoAtendimento = situacaoValida(item.status)
                ? item.status
                : "agendado";
              const agendado = situacao === "agendado";
              const jaComecou = item.inicio.getTime() <= agora.getTime();
              const fim = new Date(
                item.inicio.getTime() + item.servico.duracaoMin * 60 * 1000,
              );
              const valor = valorDoAtendimento(item);
              const cobrancaAberta = item.cobrancas.find((c) => c.situacao === "aberta");
              const cobrancaPaga = item.cobrancas.find((c) => c.situacao === "paga");

              /*
                Confirmar só faz sentido para quem ainda vai chegar. Cliente
                arquivado fica de fora, como no painel.
              */
              const telefone = telefoneParaWhatsApp(item.cliente.telefone);
              const linkDeConfirmacao =
                agendado && !jaComecou && !item.cliente.arquivadoEm && telefone.certo
                  ? linkDoWhatsApp(
                      telefone.paraWhatsApp,
                      mensagemDeConfirmacao({
                        nomeDoCliente: item.cliente.nome,
                        nomeDoEstudio: usuario.nomeNegocio,
                        nomeDoServico: item.servico.nome,
                        inicio: item.inicio,
                        agora,
                      }),
                    )
                  : null;

              /* O serviço pausado continua na lista de quem já está com ele. */
              const servicosParaRemarcar = opcoesDeServico.some(
                (opcao) => opcao.id === item.servicoId,
              )
                ? opcoesDeServico
                : [
                    {
                      id: item.servicoId,
                      nome: `${item.servico.nome} (pausado)`,
                      preco: emReais(item.servico.precoCentavos),
                      duracaoMin: item.servico.duracaoMin,
                    },
                    ...opcoesDeServico,
                  ];

              return (
                <li
                  key={item.id}
                  className={`cartao p-4 sm:p-6 ${situacao === "cancelado" ? "opacity-60" : ""}`}
                >
                  {/*
                    A coluna da hora tem largura fixa, para os nomes começarem
                    todos na mesma linha vertical, de cima a baixo da lista.
                  */}
                  <div className="flex items-start gap-4">
                    <div className="w-16 shrink-0 text-center">
                      <p className="font-display text-xl font-semibold tabular-nums text-terracota">
                        {hora(item.inicio)}
                      </p>
                      <p className="text-xs whitespace-nowrap text-carvao-suave">
                        até {hora(fim)}
                      </p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <p className="min-w-0 font-display text-lg font-semibold break-words text-carvao">
                          {item.cliente.nome}
                        </p>
                        <Etiqueta tom={TOM_DA_SITUACAO[situacao]}>
                          {ROTULO_DA_SITUACAO[situacao]}
                        </Etiqueta>
                      </div>

                      {/* Sem pontinho entre as partes: quando a linha quebra, ele sobraria solto. */}
                      <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-carvao-suave">
                        <span className="min-w-0 break-words">{item.servico.nome}</span>
                        <span className="whitespace-nowrap tabular-nums">{emReais(valor)}</span>
                        <span className="whitespace-nowrap">
                          {telefoneBonito(item.cliente.telefone)}
                        </span>
                      </div>

                      {agendado && item.confirmacaoEnviadaEm ? (
                        <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-oliva">
                          <svg
                            viewBox="0 0 24 24"
                            className="h-3.5 w-3.5 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M5 12.5l4.5 4.5L19 7.5" />
                          </svg>
                          Confirmação enviada
                        </p>
                      ) : null}

                      {item.observacoes ? (
                        <p className="mt-2 rounded-2xl bg-areia/40 px-3 py-2 text-sm break-words text-carvao-suave">
                          {item.observacoes}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-start gap-2">
                    {situacao !== "concluido" ? (
                      <form action={mudarStatus}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="status" value="concluido" />
                        <BotaoEnviar variante="suave">Concluir</BotaoEnviar>
                      </form>
                    ) : null}

                    {/* Falta só se marca depois da hora: antes dela, ainda dá tempo de chegar. */}
                    {agendado && jaComecou ? (
                      <form action={mudarStatus}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="status" value="faltou" />
                        <BotaoEnviar variante="suave">Faltou</BotaoEnviar>
                      </form>
                    ) : null}

                    {linkDeConfirmacao ? (
                      <a
                        href={linkDeConfirmacao}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="botao-suave"
                      >
                        Confirmar
                      </a>
                    ) : null}

                    {/*
                      "Cobrar" fica enquanto não houver cobrança para o horário.
                      Com uma cobrança em aberto, o botão leva até ela em vez de
                      criar outra, inclusive em horário cancelado que manteve a
                      cobrança.
                    */}
                    {cobrancaAberta ? (
                      <Link href={`/painel/cobrancas/${cobrancaAberta.id}`} className="botao-suave">
                        Ver cobrança
                      </Link>
                    ) : (situacao === "agendado" || situacao === "concluido") && !cobrancaPaga ? (
                      <Link
                        href={`/painel/cobrancas/nova?agendamento=${item.id}`}
                        className="botao-suave"
                      >
                        Cobrar
                      </Link>
                    ) : null}

                    {cobrancaPaga ? (
                      <Link href={`/painel/cobrancas/${cobrancaPaga.id}`} className="botao-texto">
                        Cobrança paga
                      </Link>
                    ) : null}

                    {agendado ? (
                      <Remarcar
                        id={item.id}
                        inicio={paraHorarioLocal(item.inicio)}
                        servicoId={item.servicoId}
                        observacoes={item.observacoes ?? ""}
                        servicos={servicosParaRemarcar}
                      />
                    ) : null}

                    {agendado && !cobrancaAberta ? (
                      <form action={mudarStatus}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="status" value="cancelado" />
                        <BotaoEnviar variante="suave">Cancelar</BotaoEnviar>
                      </form>
                    ) : null}

                    {/*
                      Cancelar um horário que tem cobrança em aberto é uma
                      decisão de dinheiro, não só de agenda. Em vez de
                      escolher por quem usa, o Bossa pergunta.
                    */}
                    {agendado && cobrancaAberta ? (
                      <details className="open:w-full">
                        <summary className="botao-suave cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                          Cancelar
                        </summary>
                        <div className="mt-2 space-y-2 rounded-xl border border-areia-escura bg-areia/40 p-3">
                          <p className="text-xs leading-relaxed text-carvao-suave">
                            Esse horário tem uma cobrança em aberto de{" "}
                            {emReais(cobrancaAberta.valorCentavos)}. O que fazer com ela?
                          </p>
                          <form action={mudarStatus}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="status" value="cancelado" />
                            <input type="hidden" name="cobranca" value="cancelar" />
                            <BotaoEnviar variante="suave" className="w-full">
                              Cancelar o horário e a cobrança
                            </BotaoEnviar>
                          </form>
                          <form action={mudarStatus}>
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="status" value="cancelado" />
                            <input type="hidden" name="cobranca" value="manter" />
                            <BotaoEnviar variante="suave" className="w-full">
                              Cancelar só o horário, continuo cobrando
                            </BotaoEnviar>
                          </form>
                        </div>
                      </details>
                    ) : null}

                    {!agendado ? (
                      <form action={mudarStatus}>
                        <input type="hidden" name="id" value={item.id} />
                        <input type="hidden" name="status" value="agendado" />
                        <BotaoEnviar variante="suave">Voltar para agendado</BotaoEnviar>
                      </form>
                    ) : null}

                    <form action={excluirAgendamento}>
                      <input type="hidden" name="id" value={item.id} />
                      <BotaoConfirmar
                        pergunta={`Apagar o horário de ${item.cliente.nome}?`}
                        className="text-rose-700 hover:border-rose-300 hover:text-rose-700"
                      >
                        Apagar
                      </BotaoConfirmar>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
