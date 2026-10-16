import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirRecurso } from "@/lib/guardas";
import { agoraDoPedido } from "@/lib/agora";
import { competenciaAtual, competenciaPorExtenso, dataEHora, emReais, somarMeses } from "@/lib/formato";
import { mesDoPedido, relatorioDoMes } from "@/lib/relatorio/operacoes";
import { pendenciasDoRelatorio } from "@/lib/relatorio/montar";
import { situacaoPorExtenso } from "@/lib/relatorio/arquivo";
import { historicoDoMes } from "@/lib/fechamento/operacoes";
import { RelatorioNaTela } from "@/componentes/relatorio-do-mes";
import { Cartao, TituloDaTela } from "@/componentes/ui/cartao";
import { Etiqueta } from "@/componentes/ui/etiqueta";
import { BotaoImprimir } from "@/componentes/ui/imprimir";
import { FormularioFechar, FormularioReabrir } from "./fechamento";

export const metadata = { title: "Relatório do mês" };
export const dynamic = "force-dynamic";

export default async function PaginaRelatorio({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { usuario } = await exigirRecurso("financas");
  const agora = agoraDoPedido();
  const { mes: pedido } = await searchParams;
  const mes = mesDoPedido(pedido, agora);
  const atual = competenciaAtual(agora);
  const periodo = competenciaPorExtenso(mes);

  const [{ relatorio, fechamento }, historico] = await Promise.all([
    relatorioDoMes(prisma, usuario.id, mes, agora),
    historicoDoMes(prisma, usuario.id, mes),
  ]);
  const fechado = Boolean(fechamento?.fechado);
  const pendencias = fechado ? [] : pendenciasDoRelatorio(relatorio);
  // A classificação de custos não trava nada: entra na lista, mas não na conta.
  const pendentes = pendencias
    .filter((item) => item.chave !== "sem-classificacao")
    .reduce((soma, item) => soma + (item.quantidade > 0 ? 1 : 0), 0);

  const anterior = somarMeses(mes, -1);
  const seguinte = somarMeses(mes, 1);
  const baixar = (formato: "csv" | "xlsx") =>
    `/painel/financas/relatorio/baixar?mes=${mes}&formato=${formato}`;

  return (
    <div className="space-y-7">
      <div className="nao-imprimir space-y-5">
        <TituloDaTela explicacao="Tudo o que entrou e saiu no mês, do jeito que o contador precisa. Baixe em planilha, imprima ou salve em PDF, e feche o mês quando estiver conferido.">
          Relatório do mês
        </TituloDaTela>

        <nav aria-label="Escolher o mês" className="flex flex-wrap items-center gap-2">
          <Link href={`/painel/financas/relatorio?mes=${anterior}`} className="botao-suave">
            ← {competenciaPorExtenso(anterior)}
          </Link>
          {seguinte <= atual ? (
            <Link href={`/painel/financas/relatorio?mes=${seguinte}`} className="botao-suave">
              {competenciaPorExtenso(seguinte)} →
            </Link>
          ) : null}
          {/* Funciona sem JavaScript: o formulário só muda o endereço. */}
          <form method="get" className="flex items-center gap-2">
            <label htmlFor="mes" className="sr-only">
              Outro mês
            </label>
            <input
              id="mes"
              name="mes"
              type="month"
              defaultValue={mes}
              max={atual}
              className="campo w-auto py-2"
            />
            <button type="submit" className="botao-texto">
              Ver
            </button>
          </form>
        </nav>

        <Cartao destaque={fechado}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-display text-lg font-semibold text-carvao">{periodo}</p>
                <Etiqueta tom={fechado ? "boa" : "espera"}>{fechado ? "Fechado" : "Em aberto"}</Etiqueta>
              </div>
              <p className="mt-1 text-sm text-carvao-suave">{situacaoPorExtenso(fechamento)}</p>
              {fechado ? (
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-carvao-suave">
                  O relatório abaixo é o que foi guardado ao fechar. Lançamentos, pagamentos da
                  equipe, contas e cobranças com data neste mês não mudam até você reabrir.
                </p>
              ) : null}
            </div>
            {fechado ? (
              <FormularioReabrir mes={mes} periodo={periodo} />
            ) : (
              <FormularioFechar mes={mes} periodo={periodo} pendentes={pendentes} />
            )}
          </div>

          {!fechado ? (
            <div className="mt-5 border-t border-areia-escura/60 pt-4">
              <p className="text-sm font-semibold text-carvao">Antes de fechar, confira</p>
              <ul className="mt-3 space-y-2">
                {pendencias.map((pendencia) => (
                  <li
                    key={pendencia.chave}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-areia-escura/70 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-carvao">
                        <span aria-hidden className="mr-1.5">
                          {pendencia.quantidade === 0 ? "✓" : "•"}
                        </span>
                        {pendencia.titulo}
                        {pendencia.quantidade > 0
                          ? ` · ${pendencia.quantidade}${
                              pendencia.totalCentavos ? ` · ${emReais(pendencia.totalCentavos)}` : ""
                            }`
                          : " · nada pendente"}
                      </p>
                      {pendencia.quantidade > 0 ? (
                        <p className="mt-0.5 text-xs text-carvao-suave">{pendencia.explicacao}</p>
                      ) : null}
                    </div>
                    {pendencia.quantidade > 0 ? (
                      <Link href={pendencia.link} className="botao-texto">
                        Resolver
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-carvao-suave">
                Nenhuma pendência impede o fechamento. Elas só ajudam o contador a não voltar
                pedindo.
              </p>
            </div>
          ) : null}

          {historico.length > 0 ? (
            <details className="mt-4 text-sm text-carvao-suave">
              <summary className="cursor-pointer font-semibold text-carvao">
                Histórico de fechamento
              </summary>
              <ul className="mt-2 space-y-1">
                {historico.map((registro, posicao) => (
                  <li key={posicao}>
                    {registro.acao === "fechou" ? "Fechado" : "Reaberto"} em{" "}
                    {dataEHora(registro.criadoEm)}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Cartao>

        <div className="flex flex-wrap gap-2">
          <a href={baixar("xlsx")} className="botao-suave" download>
            Baixar Excel
          </a>
          <a href={baixar("csv")} className="botao-suave" download>
            Baixar CSV
          </a>
          <BotaoImprimir />
          <Link href="/painel/financas/contador" className="botao-texto">
            Acesso do contador
          </Link>
        </div>
      </div>

      <RelatorioNaTela
        relatorio={relatorio}
        nomeNegocio={usuario.nomeNegocio}
        situacao={situacaoPorExtenso(fechamento)}
      />
    </div>
  );
}
