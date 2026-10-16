import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirLeituraDoRecurso } from "@/lib/guardas";
import { limiteDeIa } from "@/lib/recursos";
import { Cartao, Secao, TituloDaTela } from "@/componentes/ui/cartao";
import { Vazio } from "@/componentes/ui/estados";
import { Aviso, Etiqueta, type Tom } from "@/componentes/ui/etiqueta";
import { competenciaAtual, competenciaPorExtenso, dataPuraCurta, deDataPura, emReais } from "@/lib/formato";
import {
  ROTULO_DA_NATUREZA,
  ROTULO_DA_ORIGEM,
  deslocarMes,
  montarResumoDeCustos,
  type MesDaTendencia,
  type Natureza,
  type ResumoDeCustos,
} from "@/lib/custos/calculo";
import { carregarMovimento, mesDaTela } from "@/lib/custos/operacoes";
import { textoDasPendentes } from "@/lib/custos/sugestao";
import { iaConfigurada } from "@/lib/ia/cliente";
import { cotaDeIa } from "@/lib/ia/franquia";
import { FormularioDaNatureza } from "./natureza";
import { SugerirClassificacao } from "./sugerir";

export const metadata = { title: "Custos" };
export const dynamic = "force-dynamic";
/*
  O "Sugerir classificação" chama a IA de dentro desta página e pode levar mais
  de um minuto num mês cheio. Onde a hospedagem cortar antes disso, as regras já
  foram gravadas e o que faltou fica para o próximo toque.
*/
export const maxDuration = 120;

const TOM_DA_NATUREZA: Record<Natureza, Tom> = {
  fixo: "espera",
  variavel: "boa",
  nao_operacional: "calma",
};

/** Pontos-base (10.000 = 100%) para "45,5%". */
function emPercentual(pontosBase: number) {
  return new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 }).format(
    pontosBase / 10_000,
  );
}

function mesEmMinusculas(mes: string) {
  return competenciaPorExtenso(mes).replace(/ de \d{4}$/, "").toLowerCase();
}

export default async function PaginaCustos({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { usuario } = await exigirLeituraDoRecurso("custos");
  const { mes: pedido } = await searchParams;
  const mes = mesDaTela(pedido);
  const mesAtual = competenciaAtual();
  const ligada = iaConfigurada();

  const [movimento, cota] = await Promise.all([
    carregarMovimento(prisma, usuario.id, mes),
    ligada
      ? cotaDeIa(prisma, usuario.id, "classificacao", limiteDeIa(usuario, "classificacao"))
      : Promise.resolve(null),
  ]);
  const resumo = montarResumoDeCustos({ mes, ...movimento });
  const anterior = mesEmMinusculas(resumo.mesAnterior.mes);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link href="/painel/financas" className="botao-texto -ml-3">
          ← Finanças
        </Link>
        <TituloDaTela explicacao="Quanto do que entra vai embora em custos que se repetem todo mês, quanto acompanha os atendimentos e quanto você precisa faturar para empatar.">
          Custos do mês
        </TituloDaTela>
      </div>

      <Aviso tom="atencao">Visão gerencial — não substitui o resumo do seu contador.</Aviso>

      <nav aria-label="Mês" className="flex items-center justify-between gap-3">
        <Link href={`/painel/financas/custos?mes=${deslocarMes(mes, -1)}`} className="botao-suave" aria-label="Mês anterior">
          ←
        </Link>
        <p className="font-display text-lg font-semibold text-carvao">{competenciaPorExtenso(mes)}</p>
        {mes < mesAtual ? (
          <Link href={`/painel/financas/custos?mes=${deslocarMes(mes, 1)}`} className="botao-suave" aria-label="Próximo mês">
            →
          </Link>
        ) : (
          <span className="botao-suave invisible" aria-hidden>
            →
          </span>
        )}
      </nav>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5" aria-label="Resumo do mês">
        <Numero
          rotulo="Receita"
          valor={resumo.receitaCentavos}
          detalhe={diferenca(resumo.mesAnterior.diferencaReceitaCentavos, anterior)}
          tom="destaque"
        />
        <Numero
          rotulo="Custos fixos"
          valor={resumo.fixosCentavos}
          detalhe={diferenca(resumo.mesAnterior.diferencaFixosCentavos, anterior)}
        />
        <Numero
          rotulo="Custos variáveis"
          valor={resumo.variaveisCentavos}
          detalhe={diferenca(resumo.mesAnterior.diferencaVariaveisCentavos, anterior)}
        />
        <Numero rotulo="Fora da operação" valor={resumo.foraDaOperacaoCentavos} detalhe="Juros, multas, investimentos" />
        <Numero
          rotulo="Sem classificação"
          valor={resumo.semClassificacaoCentavos}
          detalhe={
            resumo.quantidadeSemClassificacao === 0
              ? "Nada pendente"
              : resumo.quantidadeSemClassificacao === 1
                ? "1 despesa fora da conta"
                : `${resumo.quantidadeSemClassificacao} despesas fora da conta`
          }
          tom={resumo.quantidadeSemClassificacao > 0 ? "atencao" : "neutro"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Margem resumo={resumo} />
        <PontoDeEquilibrio resumo={resumo} />
      </div>

      <Tendencia meses={resumo.tendencia} />

      <Secao
        titulo="Despesas do mês"
        explicacao="Cada saída do mês com a natureza dela. Fixo se paga mesmo sem atendimento; variável sobe e desce com eles; fora da operação não tem a ver com atender (juros, multas, investimento)."
      >
        <Cartao>
          <SugerirClassificacao
            mes={mes}
            pendentes={resumo.quantidadeSemClassificacao}
            textoDasPendentes={textoDasPendentes({
              total: resumo.despesas.length,
              pendentes: resumo.quantidadeSemClassificacao,
            })}
          />
          <p className="mt-4 text-xs leading-relaxed text-carvao-suave">
            {ligada ? (
              <>
                Primeiro valem as regras automáticas (aluguel, comissão, juros e outras). O que
                sobrar vai para a IA Claude, da Anthropic, com processamento fora do Brasil: só a
                descrição sem CPF, telefone, e-mail ou nomes de pessoas, a categoria e o valor. A IA
                só sugere; você confirma ou corrige abaixo.
                {cota ? ` Franquia do mês: ${cota.usados} de ${cota.limite} despesas. As regras não contam.` : ""}
              </>
            ) : (
              "A IA não está ligada nesta conta: o botão aplica só as regras automáticas (aluguel, comissão, juros e outras). O que elas não resolverem, classifique abaixo."
            )}
          </p>
        </Cartao>

        {resumo.despesas.length === 0 ? (
          <Vazio
            titulo="Nenhuma despesa neste mês"
            texto="Quando você registrar uma saída em Finanças, ela aparece aqui para ser classificada."
            acao={{ rotulo: "Ir para Finanças", href: "/painel/financas" }}
          />
        ) : (
          <ul className="space-y-3">
            {resumo.despesas.map((despesa) => (
              <li key={despesa.id}>
                <Cartao>
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                    <div className="min-w-0">
                      <p className="font-semibold break-words text-carvao">{despesa.descricao}</p>
                      <p className="mt-0.5 text-sm text-carvao-suave">
                        {dataPuraCurta(deDataPura(despesa.dia)!)}
                        {despesa.categoria ? ` · ${despesa.categoria}` : ""}
                        {despesa.daEquipe ? " · Veio da Equipe" : ""}
                      </p>
                    </div>
                    <p className="font-display text-lg font-semibold tabular-nums text-carvao">
                      {emReais(despesa.valorCentavos)}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {despesa.natureza ? (
                      <Etiqueta tom={TOM_DA_NATUREZA[despesa.natureza]}>
                        {ROTULO_DA_NATUREZA[despesa.natureza]}
                      </Etiqueta>
                    ) : (
                      <Etiqueta tom="atencao">Sem classificação</Etiqueta>
                    )}
                    {despesa.origem ? (
                      <span className="text-xs text-carvao-suave">
                        Origem: {ROTULO_DA_ORIGEM[despesa.origem]}
                      </span>
                    ) : null}
                  </div>
                  {despesa.motivo ? (
                    <p className="mt-1.5 text-xs leading-relaxed text-carvao-suave">{despesa.motivo}</p>
                  ) : null}

                  <div className="mt-3">
                    <FormularioDaNatureza
                      key={`${despesa.natureza}-${despesa.origem}`}
                      id={despesa.id}
                      descricao={despesa.descricao}
                      natureza={despesa.natureza}
                      origem={despesa.origem}
                    />
                  </div>
                </Cartao>
              </li>
            ))}
          </ul>
        )}

        {resumo.retiradasCentavos > 0 ? (
          <p className="text-sm text-carvao-suave">
            Retiradas e pró-labore do mês: {emReais(resumo.retiradasCentavos)}. Ficam fora da análise,
            porque são dinheiro seu, não custo do negócio.
          </p>
        ) : null}
      </Secao>
    </div>
  );
}

function diferenca(centavos: number, mesAnterior: string) {
  if (centavos === 0) return `Igual a ${mesAnterior}`;
  return `${emReais(Math.abs(centavos))} ${centavos > 0 ? "a mais" : "a menos"} que em ${mesAnterior}`;
}

function Numero({
  rotulo,
  valor,
  detalhe,
  tom = "neutro",
}: {
  rotulo: string;
  valor: number;
  detalhe: string;
  tom?: "neutro" | "destaque" | "atencao";
}) {
  const cor =
    tom === "destaque"
      ? "text-terracota"
      : tom === "atencao"
        ? "text-amber-700 dark:text-amber-400"
        : "text-carvao";
  return (
    <Cartao className="animar-entrada">
      <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">{rotulo}</p>
      <p className={`mt-1.5 font-display text-xl font-semibold tabular-nums sm:text-2xl ${cor}`}>
        {emReais(valor)}
      </p>
      <p className="mt-1 text-xs leading-snug text-carvao-suave">{detalhe}</p>
    </Cartao>
  );
}

function Margem({ resumo }: { resumo: ResumoDeCustos }) {
  const sobra = resumo.sobraACadaCemReaisCentavos;
  return (
    <Cartao>
      <h2 className="font-display text-xl font-semibold text-carvao">Margem de contribuição</h2>
      <p className="mt-1 text-sm text-carvao-suave">O que entra menos os custos variáveis.</p>
      <p
        className={`mt-4 font-display text-3xl font-semibold tabular-nums ${
          resumo.margemDeContribuicaoCentavos < 0 ? "text-rose-700 dark:text-rose-300" : "text-carvao"
        }`}
      >
        {emReais(resumo.margemDeContribuicaoCentavos)}
      </p>
      {sobra === null ? (
        <p className="mt-3 text-sm text-carvao-suave">
          Sem receita no mês, ainda não dá para calcular a margem.
        </p>
      ) : sobra > 0 ? (
        <p className="mt-3 text-carvao">
          De cada {emReais(10_000)} que entram, sobram{" "}
          <strong className="tabular-nums">{emReais(sobra)}</strong> para pagar os custos fixos.
        </p>
      ) : (
        <p className="mt-3 text-rose-700 dark:text-rose-300">
          De cada {emReais(10_000)} que entram, não sobra nada para pagar os custos fixos.
        </p>
      )}
      {resumo.pesoDosFixosPontosBase !== null && resumo.fixosCentavos > 0 ? (
        <p className="mt-2 text-sm text-carvao-suave">
          Os custos fixos levam {emPercentual(resumo.pesoDosFixosPontosBase)} do que entra.
        </p>
      ) : null}
    </Cartao>
  );
}

function PontoDeEquilibrio({ resumo }: { resumo: ResumoDeCustos }) {
  return (
    <Cartao>
      <h2 className="font-display text-xl font-semibold text-carvao">Ponto de equilíbrio</h2>
      <p className="mt-1 text-sm text-carvao-suave">
        É quanto faturar no mês para cobrir os custos fixos e variáveis, sem lucro e sem prejuízo.
      </p>
      <div className="mt-4">
        {resumo.situacaoDoPontoDeEquilibrio === "sem_custos_fixos" ? (
          <p className="text-sm text-carvao-suave">
            Classifique ao menos os custos fixos do mês para ver o ponto de equilíbrio.
          </p>
        ) : resumo.situacaoDoPontoDeEquilibrio === "sem_receita" ? (
          <p className="text-sm text-carvao-suave">
            Nada entrou neste mês, então ainda não dá para calcular.
          </p>
        ) : resumo.situacaoDoPontoDeEquilibrio === "margem_insuficiente" ? (
          <p className="text-sm text-rose-700 dark:text-rose-300">
            Com a margem de hoje, os custos variáveis já levam tudo o que entra. Nenhum faturamento
            cobre os fixos sem mudar preço ou custo.
          </p>
        ) : (
          <EquilibrioCalculado resumo={resumo} />
        )}
      </div>
    </Cartao>
  );
}

function EquilibrioCalculado({ resumo }: { resumo: ResumoDeCustos }) {
  const valor = resumo.pontoDeEquilibrioCentavos ?? 0;
  const folga = resumo.receitaCentavos - valor;
  return (
    <div className="space-y-2">
      <p className="font-display text-3xl font-semibold tabular-nums text-carvao">{emReais(valor)}</p>
      {resumo.pontoDeEquilibrioAtendimentos !== null ? (
        <p className="text-sm text-carvao">
          Cerca de <strong className="tabular-nums">{resumo.pontoDeEquilibrioAtendimentos}</strong>{" "}
          {resumo.pontoDeEquilibrioAtendimentos === 1 ? "atendimento" : "atendimentos"} no mês, pela
          margem média de cada um.
        </p>
      ) : null}
      <p className={`text-sm ${folga < 0 ? "text-rose-700 dark:text-rose-300" : "text-oliva"}`}>
        {folga >= 0
          ? `Neste mês você passou do ponto de equilíbrio em ${emReais(folga)}.`
          : `Neste mês faltaram ${emReais(-folga)} para chegar ao ponto de equilíbrio.`}
      </p>
    </div>
  );
}

/**
 * Seis meses de fixos contra variáveis, em barras lado a lado. Cada barra leva
 * cor e textura diferentes, para não depender só de enxergar a cor; os números
 * exatos ficam na tabela logo abaixo.
 */
function Tendencia({ meses }: { meses: MesDaTendencia[] }) {
  const maior = Math.max(...meses.map((m) => Math.max(m.fixosCentavos, m.variaveisCentavos)), 1);
  const temDado = meses.some((m) => m.fixosCentavos > 0 || m.variaveisCentavos > 0);
  const altura = (valor: number) => (valor > 0 ? Math.max((valor / maior) * 100, 2) : 0);

  return (
    <Cartao>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-xl font-semibold text-carvao">Fixos e variáveis</h2>
        <p className="text-sm text-carvao-suave">Últimos 6 meses</p>
      </div>

      {temDado ? (
        <>
          <div className="mt-6 flex h-44 items-end justify-between gap-2 sm:gap-4" aria-hidden>
            {meses.map((mes, posicao) => (
              <div key={mes.mes} className="flex h-full flex-1 items-end justify-center gap-1">
                <div
                  title={`Fixos em ${mes.rotulo}: ${emReais(mes.fixosCentavos)}`}
                  className="animar-barra w-1/2 max-w-7 origin-bottom rounded-t-[4px] bg-terracota"
                  style={{ height: `${altura(mes.fixosCentavos)}%`, animationDelay: `${posicao * 60}ms` }}
                />
                <div
                  title={`Variáveis em ${mes.rotulo}: ${emReais(mes.variaveisCentavos)}`}
                  className="animar-barra w-1/2 max-w-7 origin-bottom rounded-t-[4px] bg-oliva/70"
                  style={{
                    height: `${altura(mes.variaveisCentavos)}%`,
                    animationDelay: `${posicao * 60 + 30}ms`,
                    backgroundImage:
                      "repeating-linear-gradient(45deg, transparent 0 3px, rgb(255 255 255 / 0.35) 3px 5px)",
                  }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between gap-2 sm:gap-4" aria-hidden>
            {meses.map((mes) => (
              <p
                key={mes.mes}
                className="flex-1 text-center text-[11px] font-semibold tracking-wide text-carvao-suave uppercase"
              >
                {mes.rotulo}
              </p>
            ))}
          </div>
          <ul className="mt-4 flex flex-wrap gap-4 text-xs text-carvao-suave" aria-hidden>
            <li className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm bg-terracota" />
              Custos fixos
            </li>
            <li className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-sm bg-oliva/70"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(45deg, transparent 0 2px, rgb(255 255 255 / 0.35) 2px 3px)",
                }}
              />
              Custos variáveis
            </li>
          </ul>
        </>
      ) : (
        <p className="mt-3 text-sm text-carvao-suave">
          Assim que houver custos classificados, o gráfico dos últimos seis meses aparece aqui.
        </p>
      )}

      <details className="mt-5 border-t border-areia-escura/60 pt-4">
        <summary className="cursor-pointer text-sm font-semibold text-carvao-suave">
          Ver os números em tabela
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Custos fixos e variáveis dos últimos seis meses</caption>
            <thead>
              <tr className="border-b border-areia-escura/60 text-left text-carvao-suave">
                <th scope="col" className="py-2 font-medium">Mês</th>
                <th scope="col" className="py-2 text-right font-medium">Fixos</th>
                <th scope="col" className="py-2 text-right font-medium">Variáveis</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((mes) => (
                <tr key={mes.mes} className="border-b border-areia-escura/40 last:border-0">
                  <th scope="row" className="py-2 text-left font-normal text-carvao">
                    {competenciaPorExtenso(mes.mes)}
                  </th>
                  <td className="py-2 text-right tabular-nums text-carvao">{emReais(mes.fixosCentavos)}</td>
                  <td className="py-2 text-right tabular-nums text-carvao">
                    {emReais(mes.variaveisCentavos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Cartao>
  );
}
