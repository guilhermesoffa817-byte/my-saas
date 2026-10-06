import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirAcesso } from "@/lib/guardas";
import { podeUsar } from "@/lib/recursos";
import { agoraDoPedido } from "@/lib/agora";
import { Cartao, Indicador, Secao, TituloDaTela } from "@/componentes/ui/cartao";
import { Vazio } from "@/componentes/ui/estados";
import {
  Etiqueta,
  ROTULO_DA_COBRANCA,
  TOM_DA_COBRANCA,
} from "@/componentes/ui/etiqueta";
import {
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

export const metadata = { title: "Painel" };
export const dynamic = "force-dynamic";

function saudacao(data: Date) {
  const horaLocal = Number(hora(data).slice(0, 2));
  if (horaLocal < 12) return "Bom dia";
  if (horaLocal < 18) return "Boa tarde";
  return "Boa noite";
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
  const comecoDoMes = inicioDoMes(agora);
  const fimDoMes = inicioDoProximoMes(agora);

  const temCobranca = podeUsar(usuario, "cobrar");
  const temLembretes = podeUsar(usuario, "lembretes");
  const temVencimentos = podeUsar(usuario, "vencimentos");
  const temDocumentos = podeUsar(usuario, "documentos");

  const [hojeLista, concluidosNoMes, cobrancasAbertas, vencimentosProximos, documentosProntos] =
    await Promise.all([
      prisma.agendamento.findMany({
        where: {
          usuarioId: usuario.id,
          inicio: { gte: comecoDeHoje, lt: comecoDeAmanha },
          status: { not: "cancelado" },
        },
        include: { cliente: true, servico: true },
        orderBy: { inicio: "asc" },
      }),
      prisma.agendamento.findMany({
        where: {
          usuarioId: usuario.id,
          status: "concluido",
          inicio: { gte: comecoDoMes, lt: fimDoMes },
        },
        select: { servico: { select: { precoCentavos: true } } },
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
    ]);

  const faturamento = concluidosNoMes.reduce(
    (soma, item) => soma + item.servico.precoCentavos,
    0,
  );

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

  const pendentes = hojeLista.filter((item) => item.status === "agendado").length;
  const nada =
    pendentes === 0 &&
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
        explicacao={nada ? undefined : "Toque em cada um para resolver."}
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
            {pendentes > 0 ? (
              <li>
                <Link href="/painel/agenda" className="block">
                  <Cartao className="transition hover:border-terracota/50">
                    <p className="font-semibold text-carvao">
                      {pendentes === 1
                        ? "1 atendimento hoje"
                        : `${pendentes} atendimentos hoje`}
                    </p>
                    <p className="mt-0.5 text-sm text-carvao-suave">
                      O primeiro é às {hora(hojeLista[0].inicio)}, de{" "}
                      {hojeLista[0].cliente.nome}.
                    </p>
                  </Cartao>
                </Link>
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

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador
          rotulo="Faturamento do mês"
          valor={emReais(faturamento)}
          detalhe={`${concluidosNoMes.length} ${concluidosNoMes.length === 1 ? "concluído" : "concluídos"}`}
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
          valor={String(hojeLista.length)}
          detalhe={hojeLista.length === 1 ? "atendimento" : "atendimentos"}
          atraso={160}
        />
        <Indicador
          rotulo="Concluídos no mês"
          valor={String(concluidosNoMes.length)}
          detalhe="atendimentos"
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
                  <div className="flex items-center gap-4">
                    <span className="font-display text-lg font-semibold tabular-nums text-terracota">
                      {hora(item.inicio)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-carvao">
                        {item.cliente.nome}
                      </p>
                      <p className="truncate text-sm text-carvao-suave">
                        {item.servico.nome} · {emReais(item.servico.precoCentavos)}
                      </p>
                    </div>
                    {item.status === "concluido" ? (
                      <Etiqueta tom="boa">Concluído</Etiqueta>
                    ) : null}
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
    </div>
  );
}
