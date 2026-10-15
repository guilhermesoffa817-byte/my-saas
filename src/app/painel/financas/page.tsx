import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirFinanceiro } from "@/lib/guardas";
import { BotaoConfirmar } from "@/componentes/botoes";
import { Vazio } from "@/componentes/avisos";
import {
  competenciaAtual,
  dataPuraCurta,
  deDataPura,
  emReais,
  inicioDoProximoMes,
  paraDataLocal,
  somarDias,
} from "@/lib/formato";
import {
  escolherMes,
  lancamentoEmReais,
  mesValido,
  nomeDoMes,
  porDiaDaSemana,
  resumoDoMes,
  saldoEmReais,
  somarMeses,
} from "@/lib/financas";
import {
  atendimentosDoGrafico,
  movimentoDoMes,
  primeiroMesComMovimento,
} from "@/lib/financas-consultas";
import { FormularioImposto, FormularioLancamento } from "./formulario";
import { GraficoPorDiaDaSemana } from "./grafico";
import { excluirLancamento } from "./acoes";

export const metadata = { title: "Finanças" };
export const dynamic = "force-dynamic";

const ENDERECO = "/painel/financas";

export default async function PaginaFinancas({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string | string[] }>;
}) {
  const { usuario } = await exigirFinanceiro();
  const { mes: pedido } = await searchParams;

  const agora = new Date();
  const atual = competenciaAtual(agora);
  const anoAtual = Number(atual.slice(0, 4));

  /*
    O mês pedido já vai na primeira ida ao banco, junto com a busca do primeiro
    mês com movimento. Só quem pede um mês de antes do começo da conta faz a
    segunda viagem, mandado para o primeiro mês que tem o que mostrar.
  */
  const provavel = mesValido(pedido) && pedido < atual ? pedido : atual;

  const [primeiro, movimento, doGrafico] = await Promise.all([
    primeiroMesComMovimento(prisma, usuario),
    movimentoDoMes(prisma, usuario.id, provavel),
    atendimentosDoGrafico(prisma, usuario.id, agora),
  ]);

  const mes = escolherMes(pedido, { atual, primeiro });
  if (mes !== provavel) redirect(enderecoDoMes(mes, atual));

  const resumo = resumoDoMes({
    atendimentos: movimento.atendimentos,
    lancamentos: movimento.lancamentos,
    impostoPercentual: usuario.impostoPercentual,
  });
  const dias = porDiaDaSemana(doGrafico);

  const ehAtual = mes === atual;
  const nome = nomeDoMes(mes, anoAtual);
  const nomeNoTitulo = nome.charAt(0).toUpperCase() + nome.slice(1);
  const anterior = mes > primeiro ? somarMeses(mes, -1) : null;
  const seguinte = mes < atual ? somarMeses(mes, 1) : null;

  const negativo = resumo.sobrou < 0;
  const maiorLinha = Math.max(resumo.entradas, resumo.saidas + resumo.imposto, 1);

  // O último dia do mês atual: lançamento é o que já aconteceu ou acontece
  // neste mês. Conta de mês que vem mora em Vencimentos.
  const ultimoDiaPermitido = paraDataLocal(somarDias(inicioDoProximoMes(agora), -1));

  return (
    <div className="space-y-8">
      <section className="animar-entrada">
        <h1 className="font-display text-2xl font-semibold text-carvao sm:text-3xl">
          Suas finanças em {nome}
        </h1>
        <p className="mt-2 max-w-2xl text-carvao-suave">
          Tudo o que entrou e o que saiu {ehAtual ? "neste mês" : `em ${nome}`}, reunido
          num lugar só. Os atendimentos concluídos entram sozinhos; o resto você
          registra abaixo.
        </p>
      </section>

      {anterior || seguinte ? (
        <nav aria-label="Outros meses" className="flex items-center gap-3">
          {anterior ? (
            <Link href={enderecoDoMes(anterior, atual)} className="botao-suave px-4">
              <span aria-hidden>‹</span>
              <span className="sr-only">Ver </span>
              {nomeDoMes(anterior, anoAtual)}
            </Link>
          ) : null}
          {seguinte ? (
            <Link href={enderecoDoMes(seguinte, atual)} className="botao-suave ml-auto px-4">
              <span className="sr-only">Ver </span>
              {nomeDoMes(seguinte, anoAtual)}
              <span aria-hidden>›</span>
            </Link>
          ) : null}
        </nav>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Indicador titulo="Entrou" valor={emReais(resumo.entradas)} tom="boa" atraso={0}>
          <span className="whitespace-nowrap">{emReais(resumo.atendimentosCentavos)}</span> de
          atendimentos
        </Indicador>
        <Indicador titulo="Saiu" valor={emReais(resumo.saidas)} tom="neutra" atraso={80}>
          {resumo.quantasDespesas === 1
            ? "1 despesa registrada"
            : `${resumo.quantasDespesas} despesas registradas`}
        </Indicador>
        <Indicador
          titulo="Imposto estimado"
          valor={emReais(resumo.imposto)}
          tom="neutra"
          atraso={160}
        >
          {usuario.impostoPercentual}% sobre o que entrou
        </Indicador>
        {/* Mês no vermelho se lê como falta, e não como uma sobra com sinal de menos. */}
        <Indicador
          titulo={negativo ? (ehAtual ? "Faltou neste mês" : "Faltou no mês") : "Sobrou para você"}
          valor={saldoEmReais(resumo.sobrou)}
          tom={negativo ? "atencao" : "destaque"}
          atraso={240}
        >
          {negativo
            ? "as despesas e o imposto passaram do que entrou"
            : "depois das despesas e do imposto"}
        </Indicador>
      </section>

      <section className="cartao animar-entrada">
        <h2 className="font-display text-xl font-semibold text-carvao">
          {nomeNoTitulo} em uma olhada
        </h2>
        <p className="mt-1 text-sm text-carvao-suave">
          As barras mostram o tamanho de cada valor em relação ao maior deles.
        </p>

        <div className="mt-5 space-y-4">
          <LinhaDoResumo
            rotulo="Atendimentos concluídos"
            valor={resumo.atendimentosCentavos}
            maior={maiorLinha}
            cor="bg-terracota"
          />
          <LinhaDoResumo
            rotulo="Outras entradas"
            valor={resumo.entradasManuais}
            maior={maiorLinha}
            cor="bg-oliva"
          />
          <LinhaDoResumo
            rotulo="Despesas"
            valor={resumo.saidas}
            maior={maiorLinha}
            cor="bg-carvao-suave"
          />
          <LinhaDoResumo
            rotulo="Imposto estimado"
            valor={resumo.imposto}
            maior={maiorLinha}
            cor="bg-carvao-suave/60"
          />
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-areia-escura/60 pt-5">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-carvao">
              Percentual do imposto
            </p>
            <p className="mt-0.5 max-w-md text-xs leading-relaxed text-carvao-suave">
              É uma estimativa para você se organizar, não uma apuração fiscal. Ajuste
              conforme o seu regime e confirme com sua contadora.
            </p>
          </div>
          <FormularioImposto percentual={usuario.impostoPercentual} />
        </div>
      </section>

      <GraficoPorDiaDaSemana dias={dias} />

      <section className="cartao animar-entrada">
        <h2 className="font-display text-xl font-semibold text-carvao">
          Registrar um lançamento
        </h2>
        <p className="mt-1 text-sm text-carvao-suave">
          Aluguel, material, um produto vendido. Tudo o que não passa pela agenda.
        </p>
        <div className="mt-5">
          <FormularioLancamento hoje={paraDataLocal(agora)} ultimoDia={ultimoDiaPermitido} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-display text-xl font-semibold text-carvao">
          {ehAtual ? "Lançamentos deste mês" : `Lançamentos de ${nome}`}
        </h2>

        {movimento.lancamentos.length === 0 ? (
          <Vazio
            titulo={ehAtual ? "Nenhum lançamento ainda" : `Nenhum lançamento em ${nome}`}
            texto={
              ehAtual
                ? "Assim que você registrar a primeira despesa ou entrada, ela aparece aqui."
                : "Os atendimentos concluídos do mês continuam somados no resumo lá em cima."
            }
          />
        ) : (
          <ul className="space-y-3">
            {movimento.lancamentos.map((lancamento) => {
              const entrada = lancamento.tipo === "entrada";

              return (
                <li
                  key={lancamento.id}
                  className="cartao flex items-start justify-between gap-3 p-4 sm:p-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold break-words text-carvao">
                      {lancamento.descricao}
                    </p>
                    <p className="mt-0.5 text-sm break-words text-carvao-suave">
                      {dataPuraCurta(deDataPura(lancamento.dia)!)}
                      {lancamento.categoria ? ` · ${lancamento.categoria}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <span
                      className={`font-display text-lg font-semibold whitespace-nowrap tabular-nums ${
                        entrada ? "text-terracota" : "text-carvao"
                      }`}
                    >
                      {lancamentoEmReais(lancamento.tipo, lancamento.valorCentavos)}
                    </span>
                    <form action={excluirLancamento}>
                      <input type="hidden" name="id" value={lancamento.id} />
                      <BotaoConfirmar
                        pergunta={`Apagar o lançamento "${lancamento.descricao}"?`}
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

/** O mês atual mora no endereço sem parâmetro, que é o da navegação. */
function enderecoDoMes(mes: string, atual: string) {
  return mes === atual ? ENDERECO : `${ENDERECO}?mes=${mes}`;
}

function Indicador({
  titulo,
  valor,
  children,
  tom,
  atraso,
}: {
  titulo: string;
  valor: string;
  children: React.ReactNode;
  tom: "boa" | "neutra" | "destaque" | "atencao";
  atraso: number;
}) {
  const cores = {
    boa: "text-terracota",
    neutra: "text-carvao",
    destaque: "text-terracota",
    // As mesmas cores da etiqueta "Atrasada": vermelho é o que pede atenção.
    atencao: "text-rose-800 dark:text-rose-300",
  } as const;

  return (
    <div
      className={`cartao animar-entrada min-w-0 p-4 sm:p-6 ${
        tom === "atencao"
          ? "border-rose-300/70 bg-rose-50 dark:border-rose-400/30 dark:bg-rose-400/10"
          : ""
      }`}
      style={{ animationDelay: `${atraso}ms` }}
    >
      <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
        {titulo}
      </p>
      {/* Valor numa linha só: o sinal e os centavos nunca descem sozinhos. */}
      <p
        className={`mt-2 font-display text-xl font-semibold whitespace-nowrap tabular-nums sm:text-2xl ${cores[tom]}`}
      >
        {valor}
      </p>
      <p className="mt-1 text-xs text-carvao-suave">{children}</p>
    </div>
  );
}

function LinhaDoResumo({
  rotulo,
  valor,
  maior,
  cor,
}: {
  rotulo: string;
  valor: number;
  maior: number;
  cor: string;
}) {
  const largura = Math.max((valor / maior) * 100, valor > 0 ? 2 : 0);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 text-sm text-carvao-suave">{rotulo}</p>
        <p className="shrink-0 text-sm font-semibold whitespace-nowrap tabular-nums text-carvao">
          {emReais(valor)}
        </p>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-areia">
        <div
          className={`animar-largura h-full rounded-full ${cor}`}
          style={{ width: `${largura}%` }}
        />
      </div>
    </div>
  );
}
