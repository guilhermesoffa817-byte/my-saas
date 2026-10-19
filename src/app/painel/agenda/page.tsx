import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirLeitura } from "@/lib/guardas";
import { podeUsar } from "@/lib/recursos";
import { equipeQueAtende } from "@/lib/equipe-operacoes";
import { Aviso, Etiqueta, Vazio } from "@/componentes/avisos";
import { BotaoConfirmar, BotaoEnviar } from "@/componentes/botoes";
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
import { AvisoDeMesFechado } from "@/componentes/aviso-mes-fechado";
import { HORARIO_JA_OCUPADO } from "@/lib/agenda-operacoes";
import { FormularioAgendamento, RemarcarHorario, type OpcaoServico } from "./formulario";
import { DockDaSemana, type DiaDaSemana } from "./semana";
import { excluirAgendamento, mudarStatus } from "./acoes";

export const metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string; aviso?: string }>;
}) {
  const { usuario } = await exigirLeitura();
  const { dia, aviso } = await searchParams;

  const agora = new Date();
  const diaEscolhido = (dia ? deDataLocal(dia) : null) ?? deDataLocal(paraDataLocal(agora))!;
  const diaSeguinte = somarDias(diaEscolhido, 1);
  const chaveDoDia = paraDataLocal(diaEscolhido);
  const segunda = inicioDaSemana(diaEscolhido);
  const fimDaSemana = somarDias(segunda, 7);

  // "Quem atende" só aparece no Completo e quando há alguém na equipe nesse dia.
  const comEquipe = podeUsar(usuario, "equipe");

  const [clientes, servicos, daSemana, equipe] = await Promise.all([
    prisma.cliente.findMany({
      where: { usuarioId: usuario.id },
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
        colaboradorId: true,
        cliente: { select: { nome: true, telefone: true } },
        servico: { select: { nome: true, precoCentavos: true, duracaoMin: true } },
        /* Para saber se o horário já foi cobrado e se a cobrança está de pé. */
        cobrancas: { select: { id: true, situacao: true } },
        colaborador: { select: { id: true, nome: true } },
      },
      orderBy: { inicio: "asc" },
    }),
    comEquipe ? equipeQueAtende(prisma, usuario.id, chaveDoDia) : Promise.resolve([]),
  ]);

  const agendamentosDoDia = daSemana.filter(
    (item) => item.inicio >= diaEscolhido && item.inicio < diaSeguinte,
  );

  const dias: DiaDaSemana[] = Array.from({ length: 7 }, (_, posicao) => {
    const data = somarDias(segunda, posicao);
    const chave = paraDataLocal(data);
    return {
      data,
      chave,
      atendimentos: daSemana.filter(
        (item) => paraDataLocal(item.inicio) === chave && item.status !== "cancelado",
      ).length,
    };
  });

  const podeAgendar = clientes.length > 0 && servicos.length > 0;
  const sugestao = paraHorarioLocal(
    new Date(diaEscolhido.getTime() + 9 * 60 * 60 * 1000),
  );
  // Cancelado fica na lista (riscado), mas não conta como atendimento nem como previsto.
  const deVerdade = agendamentosDoDia.filter((item) => item.status !== "cancelado");
  const cancelados = agendamentosDoDia.length - deVerdade.length;
  const previsto = deVerdade.reduce((soma, item) => soma + item.servico.precoCentavos, 0);
  const resumoDoDia = [
    deVerdade.length === 0
      ? "Nenhum atendimento nesse dia"
      : `${deVerdade.length} ${deVerdade.length === 1 ? "atendimento" : "atendimentos"} · ${emReais(previsto)} previstos`,
    cancelados === 0 ? null : cancelados === 1 ? "1 cancelado" : `${cancelados} cancelados`,
  ]
    .filter(Boolean)
    .join(" · ");

  const opcoesDeServico: OpcaoServico[] = servicos.map((servico) => ({
    id: servico.id,
    nome: servico.nome,
    preco: emReais(servico.precoCentavos),
    duracaoMin: servico.duracaoMin,
  }));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-semibold text-carvao sm:text-3xl">Sua agenda</h1>
        <p className="mt-2 text-carvao-suave">
          Escolha o dia, marque os horários e vá marcando como concluído conforme
          os clientes forem saindo.
        </p>
      </section>

      <AvisoDeMesFechado aviso={aviso} mes={chaveDoDia.slice(0, 7)} />
      {aviso === "horario-ocupado" ? <Aviso tom="erro">{HORARIO_JA_OCUPADO}</Aviso> : null}
      {aviso === "remarcado" ? <Aviso tom="boa">Horário remarcado. Ele já está neste dia.</Aviso> : null}

      <section className="cartao">
        <h2 className="font-display text-xl font-semibold text-carvao">Marcar um horário</h2>

        {podeAgendar ? (
          <div className="mt-5">
            <FormularioAgendamento
              inicioSugerido={sugestao}
              clientes={clientes}
              equipe={equipe}
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
          <div>
            <h2 className="font-display text-xl font-semibold text-carvao">
              {diaDaSemana(diaEscolhido).replace(/^./, (l) => l.toUpperCase())},{" "}
              {dataPorExtenso(diaEscolhido)}
            </h2>
            <p className="text-sm text-carvao-suave">{resumoDoDia}.</p>
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
              const fim = new Date(
                item.inicio.getTime() + item.servico.duracaoMin * 60 * 1000,
              );
              const cobrancaAberta = item.cobrancas.find((c) => c.situacao === "aberta");
              const cobrancaPaga = item.cobrancas.find((c) => c.situacao === "paga");

              return (
                <li
                  key={item.id}
                  className={`cartao flex flex-wrap items-start justify-between gap-4 ${
                    item.status === "cancelado" ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex gap-5">
                    <div className="text-center">
                      <p className="font-display text-xl font-semibold text-terracota">
                        {hora(item.inicio)}
                      </p>
                      <p className="text-xs text-carvao-suave">até {hora(fim)}</p>
                    </div>
                    <div>
                      <p className="font-display text-lg font-semibold text-carvao">
                        {item.cliente.nome}
                      </p>
                      <p className="text-sm text-carvao-suave">
                        {item.servico.nome} · {emReais(item.servico.precoCentavos)} ·{" "}
                        {telefoneBonito(item.cliente.telefone)}
                      </p>
                      {item.colaborador ? (
                        <p className="text-sm text-carvao-suave">
                          Com {item.colaborador.nome}
                        </p>
                      ) : null}
                      {item.observacoes ? (
                        <p className="mt-2 rounded-2xl bg-areia/40 px-3 py-2 text-sm text-carvao-suave">
                          {item.observacoes}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <Etiqueta
                      tom={
                        item.status === "concluido"
                          ? "boa"
                          : item.status === "cancelado"
                            ? "erro"
                            : "calma"
                      }
                    >
                      {item.status === "concluido"
                        ? "Concluído"
                        : item.status === "cancelado"
                          ? "Cancelado"
                          : "Agendado"}
                    </Etiqueta>

                    <div className="flex flex-wrap justify-end gap-2">
                      {/* Concluir só o que está agendado: cancelado volta para agendado antes. */}
                      {item.status === "agendado" ? (
                        <form action={mudarStatus}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="status" value="concluido" />
                          <BotaoEnviar variante="suave">Concluir</BotaoEnviar>
                        </form>
                      ) : null}

                      {/*
                        "Cobrar" fica enquanto não houver cobrança paga para o
                        horário. Com uma cobrança em aberto, o botão leva até
                        ela em vez de criar outra.
                      */}
                      {item.status !== "cancelado" && !cobrancaPaga ? (
                        <Link
                          href={
                            cobrancaAberta
                              ? `/painel/cobrancas/${cobrancaAberta.id}`
                              : `/painel/cobrancas/nova?agendamento=${item.id}`
                          }
                          className="botao-suave"
                        >
                          {cobrancaAberta ? "Ver cobrança" : "Cobrar"}
                        </Link>
                      ) : null}

                      {cobrancaPaga ? (
                        <Link
                          href={`/painel/cobrancas/${cobrancaPaga.id}`}
                          className="botao-texto"
                        >
                          Cobrança paga
                        </Link>
                      ) : null}

                      {item.status === "agendado" && !cobrancaAberta ? (
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
                      {item.status === "agendado" && cobrancaAberta ? (
                        <details className="w-full">
                          <summary className="botao-suave w-full cursor-pointer list-none">
                            Cancelar
                          </summary>
                          <div className="mt-2 space-y-2 rounded-xl border border-areia-escura bg-areia/40 p-3">
                            <p className="text-xs leading-relaxed text-carvao-suave">
                              Esse horário tem uma cobrança em aberto de{" "}
                              {emReais(item.servico.precoCentavos)}. O que fazer com ela?
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

                      {item.status === "agendado" ? (
                        <RemarcarHorario
                          /* Remarcou: a chave muda e o formulário volta fechado. */
                          key={`${item.inicio.getTime()}-${item.servicoId}-${item.colaboradorId ?? ""}`}
                          id={item.id}
                          inicio={paraHorarioLocal(item.inicio)}
                          servicoId={item.servicoId}
                          colaboradorId={item.colaboradorId}
                          servicos={
                            opcoesDeServico.some((opcao) => opcao.id === item.servicoId)
                              ? opcoesDeServico
                              : [
                                  // Serviço guardado depois de marcado: continua na lista deste horário.
                                  {
                                    id: item.servicoId,
                                    nome: item.servico.nome,
                                    preco: emReais(item.servico.precoCentavos),
                                    duracaoMin: item.servico.duracaoMin,
                                  },
                                  ...opcoesDeServico,
                                ]
                          }
                          equipe={
                            !comEquipe
                              ? []
                              : item.colaborador && !equipe.some((pessoa) => pessoa.id === item.colaborador!.id)
                                ? [...equipe, item.colaborador]
                                : equipe
                          }
                          servicoTravado={item.cobrancas.some((c) => c.situacao !== "cancelada")}
                        />
                      ) : null}

                      {item.status !== "agendado" ? (
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
