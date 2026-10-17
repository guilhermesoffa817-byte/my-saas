/**
 * O relatório como arquivo para baixar: CSV ou Excel. A rota da dona e a do
 * contador entregam exatamente o mesmo arquivo, montado aqui.
 */
import { dataEHora } from "@/lib/formato";
import type { RelatorioDoMes } from "./montar";
import { linhasDaPlanilha, nomeDoArquivo, planilhaEmCsv } from "./planilha";
import { planilhaEmXlsx } from "./xlsx";
import type { SituacaoDoFechamento } from "./operacoes";

export type Formato = "csv" | "xlsx";

export function ehFormato(valor: unknown): valor is Formato {
  return valor === "csv" || valor === "xlsx";
}

/** A frase da situação do mês, igual na tela e no arquivo. */
export function situacaoPorExtenso(fechamento: SituacaoDoFechamento) {
  if (fechamento?.fechado) return `Fechado em ${dataEHora(fechamento.fechadoEm)}`;
  if (fechamento?.reabertoEm) return `Em aberto · reaberto em ${dataEHora(fechamento.reabertoEm)}`;
  return "Em aberto";
}

export async function respostaComArquivo(params: {
  relatorio: RelatorioDoMes;
  nomeNegocio: string;
  fechamento: SituacaoDoFechamento;
  formato: Formato;
  agora: Date;
}) {
  const linhas = linhasDaPlanilha(params.relatorio, {
    nomeNegocio: params.nomeNegocio,
    situacao: situacaoPorExtenso(params.fechamento),
    geradoEm: dataEHora(params.agora),
  });
  const nome = nomeDoArquivo(params.nomeNegocio, params.relatorio.mes, params.formato);

  const cabecalhos = {
    "Content-Disposition": `attachment; filename="${nome}"`,
    // Dinheiro do estúdio: nenhum cache no meio do caminho guarda isto.
    "Cache-Control": "private, no-store, max-age=0",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
  };

  if (params.formato === "csv") {
    return new Response(planilhaEmCsv(linhas), {
      headers: { ...cabecalhos, "Content-Type": "text/csv; charset=utf-8" },
    });
  }

  const planilha = await planilhaEmXlsx(linhas, `Relatório ${params.relatorio.mes}`);
  return new Response(new Uint8Array(planilha), {
    headers: {
      ...cabecalhos,
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}
