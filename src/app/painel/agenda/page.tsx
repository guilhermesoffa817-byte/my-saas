import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
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
import { FormularioAgendamento } from "./formulario";
import { DockDaSemana, type DiaDaSemana } from "./semana";
import { excluirAgendamento, mudarStatus } from "./acoes";

export const metadata = { title: "Agenda — Agenda Online" };
export const dynamic = "force-dynamic";

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ dia?: string }>;
}) {
  const { usuario } = await exigirAcesso();
  const { dia } = await searchParams;

  const agora = new Date();
  const diaEscolhido = (dia ? deDataLocal(dia) : null) ?? deDataLocal(paraDataLocal(agora))!;
  const diaSeguinte = somarDias(diaEscolhido, 1);
  const chaveDoDia = paraDataLocal(diaEscolhido);
  const segunda = inicioDaSemana(diaEscolhido);
  const fimDaSemana = somarDias(segunda, 7);

  const [clientes, servicos, daSemana] = await Promise.all([
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
        cliente: { select: { nome: true, telefone: true } },
        servico: { select: { nome: true, precoCentavos: true, duracaoMin: true } },
      },
      orderBy: { inicio: "asc" },
    }),
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
  const previsto = agendamentosDoDia
    .filter((item) => item.status !== "cancelado")
    .reduce((soma, item) => soma + item.servico.precoCentavos, 0);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-semibold text-carvao">Sua agenda</h1>
        <p className="mt-2 text-carvao-suave">
          Escolha o dia, marque os horários e vá marcando como concluído conforme
          as clientes forem saindo.
        </p>
      </section>

      <section className="cartao">
        <h2 className="font-display text-xl font-semibold text-carvao">Marcar um horário</h2>

        {podeAgendar ? (
          <div className="mt-5">
            <FormularioAgendamento
              inicioSugerido={sugestao}
              clientes={clientes}
              servicos={servicos.map((servico) => ({
                id: servico.id,
                nome: servico.nome,
                preco: emReais(servico.precoCentavos),
                duracaoMin: servico.duracaoMin,
              }))}
            />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <Aviso tom="atencao">
              Antes de marcar o primeiro horário, precisamos de{" "}
              {clientes.length === 0 ? "pelo menos uma cliente" : null}
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
            <p className="text-sm text-carvao-suave">
              {agendamentosDoDia.length === 0
                ? "Nenhum atendimento nesse dia."
                : `${agendamentosDoDia.length} ${agendamentosDoDia.length === 1 ? "atendimento" : "atendimentos"} · ${emReais(previsto)} previstos`}
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
              const fim = new Date(
                item.inicio.getTime() + item.servico.duracaoMin * 60 * 1000,
              );

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
                      {item.status !== "concluido" ? (
                        <form action={mudarStatus}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="status" value="concluido" />
                          <BotaoEnviar variante="suave">Concluir</BotaoEnviar>
                        </form>
                      ) : null}

                      {item.status === "agendado" ? (
                        <form action={mudarStatus}>
                          <input type="hidden" name="id" value={item.id} />
                          <input type="hidden" name="status" value="cancelado" />
                          <BotaoEnviar variante="suave">Cancelar</BotaoEnviar>
                        </form>
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
