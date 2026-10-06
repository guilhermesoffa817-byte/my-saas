import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirRecurso } from "@/lib/guardas";
import { Cartao, Indicador, Secao, TituloDaTela } from "@/componentes/ui/cartao";
import { Vazio } from "@/componentes/ui/estados";
import {
  Etiqueta,
  ROTULO_DO_VENCIMENTO,
  TOM_DO_VENCIMENTO,
} from "@/componentes/ui/etiqueta";
import { BotaoConfirmar } from "@/componentes/ui/botao";
import {
  dataPuraCurta,
  emReais,
  hojeNoEstudio,
  paraDataPura,
  somarDiasPuros,
} from "@/lib/formato";
import { avisoDoVencimento, situacaoDoVencimento } from "@/lib/vencimento";
import { FormularioDeVencimento } from "./formulario";
import { BotaoPagar } from "./pagar";
import { completarRepeticao, encerrarRepeticao, excluirVencimento } from "./acoes";

export const metadata = { title: "Vencimentos" };
export const dynamic = "force-dynamic";

export default async function PaginaVencimentos({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string }>;
}) {
  const { usuario } = await exigirRecurso("vencimentos");
  const { ver } = await searchParams;
  const mostrarPagos = ver === "pagos";
  const mostrarTudo = ver === "tudo";

  /*
    Antes de listar, o Bossa completa as repetições. É aqui que as próximas
    datas nascem: sem tarefa agendada, sem servidor acordando de madrugada.
    Abrir a tela é o gatilho.
  */
  const repeticoes = await prisma.repeticaoDeVencimento.findMany({
    where: { usuarioId: usuario.id, ativa: true },
    select: { id: true },
  });
  for (const repeticao of repeticoes) {
    await completarRepeticao(repeticao.id, usuario.id);
  }

  const hoje = hojeNoEstudio();

  /*
    Quem guarda um aluguel que repete passa a ter doze datas futuras. Mostrar as
    doze de uma vez transforma a tela numa rolagem sem fim e esconde o que
    precisa de atenção hoje. Por padrão aparece o que está atrasado e o que vence
    nos próximos sessenta dias; o resto fica a um toque de distância.
  */
  const JANELA_EM_DIAS = 60;
  const limite = somarDiasPuros(hoje, JANELA_EM_DIAS);

  const [lista, combinados, totalEmAberto] = await Promise.all([
    prisma.vencimento.findMany({
      where: {
        usuarioId: usuario.id,
        pago: mostrarPagos,
        ...(mostrarPagos || mostrarTudo ? {} : { data: { lte: limite } }),
      },
      orderBy: mostrarPagos ? { pagoEm: "desc" } : { data: "asc" },
      take: 100,
      select: {
        id: true,
        tipo: true,
        descricao: true,
        categoria: true,
        valorCentavos: true,
        data: true,
        pago: true,
        pagoEm: true,
        repeticaoId: true,
      },
    }),
    prisma.repeticaoDeVencimento.findMany({
      where: { usuarioId: usuario.id, ativa: true },
      orderBy: { criadoEm: "desc" },
      select: {
        id: true,
        descricao: true,
        valorCentavos: true,
        primeira: true,
        ate: true,
      },
    }),
    prisma.vencimento.count({ where: { usuarioId: usuario.id, pago: false } }),
  ]);

  const emAberto = lista.filter((item) => !item.pago);
  const aPagar = emAberto
    .filter((item) => item.tipo === "conta")
    .reduce((soma, item) => soma + (item.valorCentavos ?? 0), 0);
  const atrasados = emAberto.filter(
    (item) => situacaoDoVencimento(item, hoje) === "atrasado",
  );

  return (
    <div className="space-y-7">
      <TituloDaTela explicacao="Tudo o que tem data: contas a pagar e prazos de contrato.">
        Vencimentos
      </TituloDaTela>

      {!mostrarPagos ? (
        <section className="grid grid-cols-2 gap-3 sm:gap-4">
          <Indicador
            rotulo="A pagar"
            valor={emReais(aPagar)}
            detalhe={
              mostrarTudo
                ? `${emAberto.length} em aberto`
                : `${emAberto.length} ${emAberto.length === 1 ? "vence" : "vencem"} em até ${JANELA_EM_DIAS} dias`
            }
            tom="destaque"
          />
          <Indicador
            rotulo="Atrasado"
            valor={emReais(
              atrasados.reduce((soma, item) => soma + (item.valorCentavos ?? 0), 0),
            )}
            detalhe={
              atrasados.length === 1 ? "1 passou da data" : `${atrasados.length} passaram da data`
            }
            tom={atrasados.length > 0 ? "atencao" : "neutro"}
            atraso={80}
          />
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {mostrarPagos || mostrarTudo ? (
          <Link href="/painel/vencimentos" className="botao-suave">
            Ver os próximos
          </Link>
        ) : null}
        {!mostrarTudo && totalEmAberto > lista.length && !mostrarPagos ? (
          <Link href="/painel/vencimentos?ver=tudo" className="botao-suave">
            Ver todos os {totalEmAberto} em aberto
          </Link>
        ) : null}
        {!mostrarPagos ? (
          <Link href="/painel/vencimentos?ver=pagos" className="botao-suave">
            Ver os já pagos
          </Link>
        ) : null}
      </div>

      <Secao
        titulo={mostrarPagos ? "Já pagos" : mostrarTudo ? "Todos em aberto" : "Próximos"}
        explicacao={
          mostrarPagos || mostrarTudo
            ? undefined
            : `O que está atrasado e o que vence nos próximos ${JANELA_EM_DIAS} dias.`
        }
      >
        {lista.length === 0 ? (
          <Vazio
            titulo={mostrarPagos ? "Nada pago ainda" : "Nenhum vencimento guardado"}
            texto={
              mostrarPagos
                ? "Quando você marcar uma conta como paga, ela aparece aqui."
                : "Guarde abaixo o aluguel, a conta de luz ou o fim de um contrato, e o Bossa avisa quando chegar perto."
            }
          />
        ) : (
          <ul className="space-y-3">
            {lista.map((item) => {
              const situacao = situacaoDoVencimento(item, hoje);
              const aviso = avisoDoVencimento(
                { ...item, tipo: item.tipo as "conta" | "prazo" },
                hoje,
              );

              return (
                <li key={item.id}>
                  <Cartao destaque={situacao === "atrasado"}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-carvao">{item.descricao}</p>
                        <p className="mt-0.5 text-sm text-carvao-suave">
                          {item.pago && item.pagoEm
                            ? `Pago em ${dataPuraCurta(item.pagoEm)}`
                            : dataPuraCurta(item.data)}
                          {item.categoria ? ` · ${item.categoria}` : ""}
                          {item.repeticaoId ? " · todo mês" : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {item.valorCentavos ? (
                          <p className="font-display text-lg font-semibold tabular-nums text-carvao">
                            {emReais(item.valorCentavos)}
                          </p>
                        ) : null}
                        <div className="mt-1">
                          <Etiqueta tom={TOM_DO_VENCIMENTO[situacao]}>
                            {ROTULO_DO_VENCIMENTO[situacao]}
                          </Etiqueta>
                        </div>
                      </div>
                    </div>

                    {aviso && situacao !== "vence_hoje" ? (
                      <p className="mt-2 text-sm font-semibold text-carvao-suave">{aviso}</p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {!item.pago ? (
                        <BotaoPagar
                          id={item.id}
                          hoje={paraDataPura(hoje)}
                          rotulo={item.tipo === "conta" ? "Marcar como pago" : "Marcar como resolvido"}
                        />
                      ) : null}
                      <form action={excluirVencimento}>
                        <input type="hidden" name="id" value={item.id} />
                        <BotaoConfirmar
                          pergunta={`Apagar "${item.descricao}"?${item.pago ? " A saída lançada nas finanças sai junto." : ""}`}
                          className="text-rose-700 hover:border-rose-300 hover:text-rose-700"
                        >
                          Apagar
                        </BotaoConfirmar>
                      </form>
                    </div>
                  </Cartao>
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      {combinados.length > 0 ? (
        <Secao
          titulo="Combinados que se repetem"
          explicacao="O Bossa mantém as próximas datas de cada um sozinho."
        >
          <ul className="space-y-3">
            {combinados.map((combinado) => (
              <li key={combinado.id}>
                <Cartao>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-carvao">{combinado.descricao}</p>
                      <p className="mt-0.5 text-sm text-carvao-suave">
                        Todo dia {dataPuraCurta(combinado.primeira).slice(0, 2)}
                        {combinado.valorCentavos
                          ? ` · ${emReais(combinado.valorCentavos)}`
                          : ""}
                        {combinado.ate ? ` · até ${dataPuraCurta(combinado.ate)}` : ""}
                      </p>
                    </div>
                    <form action={encerrarRepeticao}>
                      <input type="hidden" name="id" value={combinado.id} />
                      <BotaoConfirmar
                        pergunta={`Encerrar "${combinado.descricao}"? As datas futuras que ninguém pagou somem; o que já foi pago fica no histórico.`}
                      >
                        Encerrar
                      </BotaoConfirmar>
                    </form>
                  </div>
                </Cartao>
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      <Secao titulo="Guardar um vencimento">
        <Cartao>
          <FormularioDeVencimento hoje={paraDataPura(hoje)} />
        </Cartao>
      </Secao>
    </div>
  );
}
