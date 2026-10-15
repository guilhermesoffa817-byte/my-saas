import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import { podeUsar } from "@/lib/recursos";
import { agoraDoPedido } from "@/lib/agora";
import { Cartao, Indicador, Secao, TituloDaTela } from "@/componentes/ui/cartao";
import { Vazio } from "@/componentes/ui/estados";
import { BotaoEnviar } from "@/componentes/ui/botao";
import {
  Etiqueta,
  ROTULO_DA_COBRANCA,
  TOM_DA_COBRANCA,
} from "@/componentes/ui/etiqueta";
import {
  FUSO,
  dataPorExtenso,
  dataPuraCurta,
  diaDaSemana,
  diferencaEmDias,
  emReais,
  hojeNoEstudio,
  hora,
  inicioDoDia,
  inicioDoMes,
  inicioDoProximoMes,
  primeiroNome,
  somarDias,
  somarDiasPuros,
} from "@/lib/formato";
import {
  lembreteDeHoje,
  prazoPorExtenso,
  situacaoDaCobranca,
  type CodigoDoMomento,
  type PreferenciaDeLembrete,
} from "@/lib/cobranca";
import { avisoDoVencimento } from "@/lib/vencimento";
import {
  ROTULO_DA_SITUACAO,
  SITUACOES_QUE_OCUPAM,
  valorDoAtendimento,
} from "@/lib/atendimento";
import { mensagemDeConfirmacao, ordenarParaConfirmar } from "@/lib/confirmacao";
import { aniversariantes, mensagemDeParabens, quandoFazAniversario } from "@/lib/aniversario";
import { linkDoWhatsApp, telefoneParaWhatsApp } from "@/lib/telefone";
import { chamadaDeHoje } from "./agenda/regras";
import { marcarConfirmacao } from "./agenda/acoes";

export const metadata = { title: "Painel" };
export const dynamic = "force-dynamic";

function saudacao(data: Date) {
  const horaLocal = Number(hora(data).slice(0, 2));
  if (horaLocal < 12) return "Bom dia";
  if (horaLocal < 18) return "Boa tarde";
  return "Boa noite";
}

/** O sinal de feito, ao lado da palavra. Sozinho ele não diria nada. */
function Visto() {
  return (
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
  );
}

/**
 * A tela inicial responde uma pergunta só: o que precisa de mim hoje?
 *
 * Antes ela mostrava quatro números e a agenda. Números são bons para fechar o
 * mês, mas não dizem o que fazer agora. Agora o que vem primeiro é a lista de
 * coisas que esperam uma atitude: o atendimento de hoje, quem lembrar de
 * cobrar, o que vence nos próximos dias e o documento esperando conferência.
 */
export default async function PaginaPainel() {
  const { usuario } = await exigirAcesso();

  const agora = agoraDoPedido();
  const hoje = hojeNoEstudio(agora);
  const comecoDeHoje = inicioDoDia(agora);
  const comecoDeAmanha = somarDias(comecoDeHoje, 1);
  const comecoDeDepoisDeAmanha = somarDias(comecoDeHoje, 2);
  const comecoDoMes = inicioDoMes(agora);
  const fimDoMes = inicioDoProximoMes(agora);

  const temCobranca = podeUsar(usuario, "cobrar");
  const temLembretes = podeUsar(usuario, "lembretes");
  const temVencimentos = podeUsar(usuario, "vencimentos");
  const temDocumentos = podeUsar(usuario, "documentos");

  const [
    hojeLista,
    concluidosNoMes,
    cobrancasAbertas,
    vencimentosProximos,
    documentosProntos,
    deAmanha,
    comNascimento,
  ] = await Promise.all([
    prisma.agendamento.findMany({
      where: {
        usuarioId: usuario.id,
        inicio: { gte: comecoDeHoje, lt: comecoDeAmanha },
        status: { not: "cancelado" },
      },
      select: {
        id: true,
        inicio: true,
        status: true,
        valorCentavos: true,
        cliente: { select: { nome: true } },
        servico: { select: { nome: true, precoCentavos: true } },
      },
      orderBy: { inicio: "asc" },
    }),
    prisma.agendamento.findMany({
      where: {
        usuarioId: usuario.id,
        status: "concluido",
        inicio: { gte: comecoDoMes, lt: fimDoMes },
      },
      select: { valorCentavos: true, servico: { select: { precoCentavos: true } } },
    }),
    temCobranca
      ? prisma.cobranca.findMany({
          where: { usuarioId: usuario.id, situacao: "aberta" },
          orderBy: { vencimento: "asc" },
          select: {
            id: true,
            valorCentavos: true,
            vencimento: true,
            situacao: true,
            cliente: { select: { nome: true, semLembretes: true } },
            lembretes: { select: { momento: true } },
          },
        })
      : Promise.resolve([]),
    temVencimentos
      ? prisma.vencimento.findMany({
          where: {
            usuarioId: usuario.id,
            pago: false,
            data: { lte: somarDiasPuros(hoje, 7) },
          },
          orderBy: { data: "asc" },
          take: 5,
          select: { id: true, descricao: true, data: true, valorCentavos: true, tipo: true },
        })
      : Promise.resolve([]),
    temDocumentos
      ? prisma.documento.count({ where: { usuarioId: usuario.id, situacao: "pronto" } })
      : Promise.resolve(0),
    /* Os horários de amanhã que pedem confirmação. Cliente arquivado fica de fora. */
    prisma.agendamento.findMany({
      where: {
        usuarioId: usuario.id,
        status: "agendado",
        inicio: { gte: comecoDeAmanha, lt: comecoDeDepoisDeAmanha },
        cliente: { arquivadoEm: null },
      },
      select: {
        id: true,
        inicio: true,
        confirmacaoEnviadaEm: true,
        cliente: { select: { nome: true, telefone: true } },
        servico: { select: { nome: true } },
      },
      orderBy: { inicio: "asc" },
    }),
    /*
      Quem tem data de nascimento na ficha. O dia e o mês se comparam aqui no
      servidor, porque o banco guarda o nascimento com ano e hora.
    */
    prisma.cliente.findMany({
      where: { usuarioId: usuario.id, arquivadoEm: null, nascimento: { not: null } },
      select: { id: true, nome: true, telefone: true, nascimento: true },
    }),
  ]);

  const faturamento = concluidosNoMes.reduce(
    (soma, item) => soma + valorDoAtendimento(item),
    0,
  );
  const mesAtual = agora.toLocaleDateString("pt-BR", { timeZone: FUSO, month: "long" });

  const preferencias: PreferenciaDeLembrete = {
    antes: usuario.lembreteAntes,
    no_dia: usuario.lembreteNoDia,
    tres_dias: usuario.lembreteTresDias,
    sete_dias: usuario.lembreteSeteDias,
  };

  const paraLembrar = temLembretes
    ? cobrancasAbertas.filter(
        (cobranca) =>
          !cobranca.cliente.semLembretes &&
          lembreteDeHoje({
            vencimento: cobranca.vencimento,
            hoje,
            preferencias,
            jaEnviados: cobranca.lembretes.map((item) => item.momento as CodigoDoMomento),
          }) !== null,
      )
    : [];

  const aReceber = cobrancasAbertas.reduce((soma, item) => soma + item.valorCentavos, 0);
  const atrasadas = cobrancasAbertas.filter(
    (cobranca) => situacaoDaCobranca(cobranca, hoje) === "atrasada",
  );

  const atrasadosDeVerdade = vencimentosProximos.filter(
    (item) => diferencaEmDias(hoje, item.data) < 0,
  ).length;

  const agendadosHoje = hojeLista.filter((item) => item.status === "agendado");
  const pendentes = agendadosHoje.length;
  const chamada = chamadaDeHoje(agendadosHoje, agora);
  const atendimentosHoje = hojeLista.filter((item) =>
    (SITUACOES_QUE_OCUPAM as string[]).includes(item.status),
  ).length;

  const paraConfirmar = ordenarParaConfirmar(deAmanha);
  const faltamConfirmar = paraConfirmar.filter((item) => !item.confirmacaoEnviadaEm).length;

  const aniversariantesDaSemana = aniversariantes(comNascimento, hoje);

  const nada =
    pendentes === 0 &&
    faltamConfirmar === 0 &&
    paraLembrar.length === 0 &&
    vencimentosProximos.length === 0 &&
    documentosProntos === 0;

  return (
    <div className="space-y-7">
      <section className="animar-entrada">
        <p className="text-sm text-carvao-suave">
          {diaDaSemana(agora).replace(/^./, (l) => l.toUpperCase())}, {dataPorExtenso(agora)}
        </p>
        <TituloDaTela>
          {saudacao(agora)}, {primeiroNome(usuario.nome)}
        </TituloDaTela>
      </section>

      <Secao
        titulo="O que precisa de você hoje"
        explicacao={nada ? undefined : "Abra cada um para resolver."}
      >
        {nada ? (
          <Cartao>
            <p className="leading-relaxed text-carvao-suave">
              Nada esperando por você agora. Dia bom para respirar, organizar o
              estúdio ou chamar aquele cliente que sumiu.
            </p>
          </Cartao>
        ) : (
          <ul className="space-y-3">
            {pendentes > 0 && chamada ? (
              <li>
                <Link href="/painel/agenda" className="block">
                  <Cartao className="transition hover:border-terracota/50">
                    <p className="font-semibold text-carvao">
                      {pendentes === 1
                        ? "1 atendimento hoje"
                        : `${pendentes} atendimentos hoje`}
                    </p>
                    {/*
                      Depois do primeiro horário, dizer quem foi o primeiro não
                      ajuda mais. O que importa é quem vem a seguir.
                    */}
                    <p className="mt-0.5 text-sm text-carvao-suave">
                      {chamada.tipo === "primeiro"
                        ? `O primeiro é às ${hora(chamada.atendimento.inicio)}, de ${chamada.atendimento.cliente.nome}.`
                        : chamada.tipo === "proximo"
                          ? `O próximo é às ${hora(chamada.atendimento.inicio)}, de ${chamada.atendimento.cliente.nome}.`
                          : pendentes === 1
                            ? "O horário já começou. Marque na agenda como foi."
                            : "Todos já começaram. Marque na agenda como foi cada um."}
                    </p>
                  </Cartao>
                </Link>
              </li>
            ) : null}

            {faltamConfirmar > 0 ? (
              <li>
                <a href="#confirmar-amanha" className="block">
                  <Cartao className="transition hover:border-terracota/50">
                    <p className="font-semibold text-carvao">
                      {faltamConfirmar === 1
                        ? "1 horário de amanhã para confirmar"
                        : `${faltamConfirmar} horários de amanhã para confirmar`}
                    </p>
                    <p className="mt-0.5 text-sm text-carvao-suave">
                      Uma mensagem hoje evita falta amanhã.
                    </p>
                  </Cartao>
                </a>
              </li>
            ) : null}

            {paraLembrar.length > 0 ? (
              <li>
                <Link href="/painel/cobrancas" className="block">
                  <Cartao destaque className="transition hover:border-terracota/60">
                    <p className="font-semibold text-carvao">
                      {paraLembrar.length === 1
                        ? "1 cliente para lembrar da cobrança"
                        : `${paraLembrar.length} clientes para lembrar da cobrança`}
                    </p>
                    <p className="mt-0.5 text-sm text-carvao-suave">
                      {paraLembrar
                        .slice(0, 3)
                        .map((c) => c.cliente.nome)
                        .join(", ")}
                      {paraLembrar.length > 3 ? " e mais" : ""}.
                    </p>
                  </Cartao>
                </Link>
              </li>
            ) : null}

            {vencimentosProximos.length > 0 ? (
              <li>
                <Link href="/painel/vencimentos" className="block">
                  <Cartao
                    destaque={atrasadosDeVerdade > 0}
                    className="transition hover:border-terracota/50"
                  >
                    <p className="font-semibold text-carvao">
                      {/*
                        "Conta vencendo" ao lado de "venceu há sete dias" se
                        contradiz. Quando já passou da data, a palavra é outra.
                      */}
                      {atrasadosDeVerdade > 0
                        ? atrasadosDeVerdade === 1
                          ? "1 conta atrasada"
                          : `${atrasadosDeVerdade} contas atrasadas`
                        : vencimentosProximos.length === 1
                          ? "1 conta vencendo"
                          : `${vencimentosProximos.length} contas vencendo`}
                    </p>
                    <p className="mt-0.5 text-sm text-carvao-suave">
                      {vencimentosProximos[0].descricao} ·{" "}
                      {avisoDoVencimento(
                        {
                          pago: false,
                          data: vencimentosProximos[0].data,
                          tipo: vencimentosProximos[0].tipo as "conta" | "prazo",
                        },
                        hoje,
                      ) ?? dataPuraCurta(vencimentosProximos[0].data)}
                    </p>
                  </Cartao>
                </Link>
              </li>
            ) : null}

            {documentosProntos > 0 ? (
              <li>
                <Link href="/painel/documentos" className="block">
                  <Cartao className="transition hover:border-terracota/50">
                    <p className="font-semibold text-carvao">
                      {documentosProntos === 1
                        ? "1 documento esperando conferência"
                        : `${documentosProntos} documentos esperando conferência`}
                    </p>
                    <p className="mt-0.5 text-sm text-carvao-suave">
                      O Bossa leu e separou o que achou. Falta você conferir.
                    </p>
                  </Cartao>
                </Link>
              </li>
            ) : null}
          </ul>
        )}
      </Secao>

      {paraConfirmar.length > 0 ? (
        <div id="confirmar-amanha" className="scroll-mt-28">
          <Secao
            titulo="Confirmar horários de amanhã"
            explicacao="Uma mensagem na véspera evita falta. O Bossa escreve, você só envia e conta que mandou."
          >
            <ul className="space-y-2.5">
              {paraConfirmar.map((item) => {
                const enviada = Boolean(item.confirmacaoEnviadaEm);
                const telefone = telefoneParaWhatsApp(item.cliente.telefone);
                const link = telefone.certo
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

                return (
                  <li key={item.id}>
                    <Cartao>
                      <div className="flex items-start gap-3">
                        <span className="w-14 shrink-0 font-display text-lg font-semibold tabular-nums text-terracota">
                          {hora(item.inicio)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold break-words text-carvao">
                            {item.cliente.nome}
                          </p>
                          <p className="text-sm break-words text-carvao-suave">
                            {item.servico.nome}
                          </p>
                          {/* Já resolvido: fica embaixo, pequeno, com o desfazer ao lado. */}
                          {enviada ? (
                            <div className="mt-2 flex flex-wrap items-center gap-x-1 gap-y-1">
                              <Etiqueta tom="boa">
                                <Visto />
                                Confirmação enviada
                              </Etiqueta>
                              <form action={marcarConfirmacao}>
                                <input type="hidden" name="id" value={item.id} />
                                <input type="hidden" name="enviada" value="nao" />
                                <BotaoEnviar variante="texto">Desfazer</BotaoEnviar>
                              </form>
                            </div>
                          ) : null}
                        </div>
                      </div>

                      {enviada ? null : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {link ? (
                            <a
                              href={link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="botao grow"
                            >
                              Confirmar pelo WhatsApp
                            </a>
                          ) : (
                            <p className="w-full text-xs leading-relaxed text-carvao-suave">
                              {telefone.certo ? null : telefone.motivo}
                            </p>
                          )}
                          <form action={marcarConfirmacao} className="grow sm:grow-0">
                            <input type="hidden" name="id" value={item.id} />
                            <input type="hidden" name="enviada" value="sim" />
                            <BotaoEnviar variante="suave" className="w-full">
                              Já mandei
                            </BotaoEnviar>
                          </form>
                        </div>
                      )}
                    </Cartao>
                  </li>
                );
              })}
            </ul>
          </Secao>
        </div>
      ) : null}

      {/*
        Rótulos curtos de propósito: no celular, dois cartões dividem a linha, e
        um rótulo que quebra em duas linhas desalinha o número do vizinho.
      */}
      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador
          rotulo="Faturado"
          valor={emReais(faturamento)}
          detalhe={`em ${mesAtual}`}
          tom="destaque"
        />
        {temCobranca ? (
          <Indicador
            rotulo="A receber"
            valor={emReais(aReceber)}
            detalhe={
              atrasadas.length === 0
                ? `${cobrancasAbertas.length} em aberto`
                : atrasadas.length === 1
                  ? "1 atrasada"
                  : `${atrasadas.length} atrasadas`
            }
            tom={atrasadas.length > 0 ? "atencao" : "neutro"}
            atraso={80}
          />
        ) : null}
        <Indicador
          rotulo="Hoje"
          valor={String(atendimentosHoje)}
          detalhe={atendimentosHoje === 1 ? "atendimento" : "atendimentos"}
          atraso={160}
        />
        <Indicador
          rotulo="Concluídos"
          valor={String(concluidosNoMes.length)}
          detalhe={`em ${mesAtual}`}
          atraso={240}
        />
      </section>

      <Secao
        titulo="Agenda de hoje"
        acao={
          <Link href="/painel/agenda" className="botao-suave">
            Abrir agenda
          </Link>
        }
      >
        {hojeLista.length === 0 ? (
          <Vazio
            titulo="Nenhum horário marcado para hoje"
            texto="Quando você marcar um atendimento, ele aparece aqui com horário, cliente e serviço."
            acao={{ rotulo: "Marcar um horário", href: "/painel/agenda" }}
          />
        ) : (
          <ul className="space-y-2.5">
            {hojeLista.map((item) => (
              <li key={item.id}>
                <Cartao>
                  <div className="flex items-center gap-3">
                    <span className="w-14 shrink-0 font-display text-lg font-semibold tabular-nums text-terracota">
                      {hora(item.inicio)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold break-words text-carvao">
                        {item.cliente.nome}
                      </p>
                      <p className="text-sm break-words text-carvao-suave">
                        {item.servico.nome}
                      </p>
                    </div>
                    {/* O preço tem caixa própria, que não encolhe: ele aparece sempre inteiro. */}
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-sm font-semibold whitespace-nowrap tabular-nums text-carvao">
                        {emReais(valorDoAtendimento(item))}
                      </span>
                      {item.status === "concluido" ? (
                        <Etiqueta tom="boa">{ROTULO_DA_SITUACAO.concluido}</Etiqueta>
                      ) : item.status === "faltou" ? (
                        <Etiqueta tom="atencao">{ROTULO_DA_SITUACAO.faltou}</Etiqueta>
                      ) : null}
                    </div>
                  </div>
                </Cartao>
              </li>
            ))}
          </ul>
        )}
      </Secao>

      {temCobranca && atrasadas.length > 0 ? (
        <Secao
          titulo="Cobranças atrasadas"
          acao={
            <Link href="/painel/cobrancas" className="botao-suave">
              Ver todas
            </Link>
          }
        >
          <ul className="space-y-2.5">
            {atrasadas.slice(0, 3).map((cobranca) => (
              <li key={cobranca.id}>
                <Link href={`/painel/cobrancas/${cobranca.id}`} className="block">
                  <Cartao className="transition hover:border-terracota/50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-carvao">
                          {cobranca.cliente.nome}
                        </p>
                        <p className="text-sm text-carvao-suave">
                          {prazoPorExtenso(cobranca.vencimento, hoje)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-display font-semibold tabular-nums text-carvao">
                          {emReais(cobranca.valorCentavos)}
                        </p>
                        <Etiqueta tom={TOM_DA_COBRANCA.atrasada}>
                          {ROTULO_DA_COBRANCA.atrasada}
                        </Etiqueta>
                      </div>
                    </div>
                  </Cartao>
                </Link>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      {/* Sem aniversário na semana, a seção nem aparece. */}
      {aniversariantesDaSemana.length > 0 ? (
        <Secao
          titulo="Aniversários da semana"
          explicacao="Um parabéns lembrado faz o cliente se sentir em casa."
        >
          <ul className="space-y-2.5">
            {aniversariantesDaSemana.map((cliente) => {
              const telefone = telefoneParaWhatsApp(cliente.telefone);
              const link = telefone.certo
                ? linkDoWhatsApp(
                    telefone.paraWhatsApp,
                    mensagemDeParabens({
                      nomeDoCliente: cliente.nome,
                      nomeDoEstudio: usuario.nomeNegocio,
                      emDias: cliente.emDias,
                    }),
                  )
                : null;

              return (
                <li key={cliente.id}>
                  <Cartao destaque={cliente.emDias === 0}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold break-words text-carvao">{cliente.nome}</p>
                        <p className="text-sm text-carvao-suave">
                          {quandoFazAniversario(cliente.emDias, cliente.data)}
                        </p>
                      </div>
                      {link ? (
                        <a
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="botao-suave shrink-0"
                        >
                          Mandar parabéns
                        </a>
                      ) : (
                        <p className="w-full text-xs leading-relaxed text-carvao-suave">
                          {telefone.certo ? null : telefone.motivo}
                        </p>
                      )}
                    </div>
                  </Cartao>
                </li>
              );
            })}
          </ul>
        </Secao>
      ) : null}
    </div>
  );
}
