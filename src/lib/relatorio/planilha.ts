/**
 * O relatório do mês em linhas de planilha, e essas linhas em CSV.
 *
 * CSV e Excel saem da mesma lista de linhas, então os dois trazem sempre os
 * mesmos números, na mesma ordem. A lista é plana (Seção, Item, Detalhe,
 * Quantidade, Valor): é o formato que o sistema do escritório de contabilidade
 * consegue importar sem ninguém arrumar coluna à mão.
 *
 * Dinheiro continua em centavos inteiros até a última hora. A única passagem
 * para reais com vírgula é `reaisDaCelula`, no Excel; no CSV o texto "1234,56"
 * é montado a partir do inteiro, sem conta com vírgula flutuante.
 */
import { dataPuraCurta, deDataPura, percentualBonito } from "@/lib/formato";
import {
  AVISO_DAS_COBRANCAS,
  AVISO_DO_IMPOSTO,
  type RelatorioDoMes,
} from "./montar";

export const COLUNAS_DA_PLANILHA = ["Seção", "Item", "Detalhe", "Quantidade", "Valor (R$)"] as const;

export type LinhaDaPlanilha = {
  secao: string;
  item: string;
  detalhe: string;
  quantidade: number | null;
  valorCentavos: number | null;
  /** Linha de total: sai em negrito no Excel. */
  destaque?: boolean;
};

export type Cabecalho = {
  nomeNegocio: string;
  /** "Fechado em 05/11/2026" ou "Em aberto". */
  situacao: string;
  geradoEm: string;
};

function dia(texto: string) {
  const data = deDataPura(texto);
  return data ? dataPuraCurta(data) : texto;
}

export function linhasDaPlanilha(relatorio: RelatorioDoMes, cabecalho: Cabecalho): LinhaDaPlanilha[] {
  const linhas: LinhaDaPlanilha[] = [];
  const linha = (
    secao: string,
    item: string,
    valorCentavos: number | null,
    extra: Partial<Omit<LinhaDaPlanilha, "secao" | "item" | "valorCentavos">> = {},
  ) =>
    linhas.push({
      secao,
      item,
      detalhe: extra.detalhe ?? "",
      quantidade: extra.quantidade ?? null,
      valorCentavos,
      destaque: extra.destaque,
    });

  const id = "Identificação";
  linha(id, "Estúdio", null, { detalhe: cabecalho.nomeNegocio });
  linha(id, "Mês", null, { detalhe: relatorio.periodo });
  linha(id, "Situação", null, {
    detalhe: relatorio.parcial
      ? `${cabecalho.situacao} · mês em andamento, números até ${dia(relatorio.referencia)}`
      : cabecalho.situacao,
  });
  linha(id, "Gerado em", null, { detalhe: cabecalho.geradoEm });

  const { entradas, saidas, equipe, resultado, cobrancas, contasAPagar } = relatorio;

  linha("Entradas", "Atendimentos concluídos", entradas.atendimentos.totalCentavos, {
    quantidade: entradas.atendimentos.quantidade,
  });
  for (const servico of entradas.atendimentos.porServico) {
    linha("Entradas por serviço", servico.rotulo, servico.totalCentavos, {
      quantidade: servico.quantidade,
    });
  }
  linha("Entradas", "Entradas lançadas à mão", entradas.manuais.totalCentavos, {
    quantidade: entradas.manuais.quantidade,
  });
  for (const categoria of entradas.manuais.porCategoria) {
    linha("Entradas lançadas por categoria", categoria.rotulo, categoria.totalCentavos, {
      quantidade: categoria.quantidade,
    });
  }
  linha("Entradas", "Cobranças avulsas recebidas", entradas.cobrancasRecebidas.totalCentavos, {
    quantidade: entradas.cobrancasRecebidas.quantidade,
  });
  linha("Entradas", "Total de entradas", entradas.totalCentavos, { destaque: true });

  for (const categoria of saidas.porCategoria) {
    linha("Saídas por categoria", categoria.rotulo, categoria.totalCentavos, {
      quantidade: categoria.quantidade,
    });
  }
  for (const natureza of saidas.porNatureza) {
    linha("Saídas por natureza", natureza.rotulo, natureza.totalCentavos, {
      quantidade: natureza.quantidade,
    });
  }
  linha("Saídas", "Total de saídas", saidas.totalCentavos, {
    quantidade: saidas.quantidade,
    destaque: true,
  });

  for (const tipo of equipe.porTipo) {
    linha("Pagamentos à equipe (já nas saídas)", tipo.rotulo, tipo.totalCentavos, {
      quantidade: tipo.quantidade,
    });
  }
  linha("Pagamentos à equipe (já nas saídas)", "Total pago à equipe", equipe.totalCentavos, {
    quantidade: equipe.quantidade,
    destaque: true,
  });

  linha("Resultado", "Entrou menos saiu", resultado.resultadoCentavos, { destaque: true });
  linha("Resultado", "Imposto estimado", resultado.impostoEstimadoCentavos, {
    detalhe: `${percentualBonito(relatorio.impostoPercentual)}% sobre as entradas · estimativa, não é guia`,
  });
  linha("Resultado", "Depois do imposto estimado", resultado.depoisDoImpostoCentavos, {
    destaque: true,
  });

  const noFim = relatorio.parcial ? `até ${dia(relatorio.referencia)}` : "na virada do mês";
  linha("Cobranças a receber", "Em aberto, no prazo", cobrancas.emAberto.totalCentavos, {
    quantidade: cobrancas.emAberto.quantidade,
    detalhe: noFim,
  });
  linha("Cobranças a receber", "Atrasadas", cobrancas.atrasadas.totalCentavos, {
    quantidade: cobrancas.atrasadas.quantidade,
    detalhe: noFim,
  });

  for (const conta of contasAPagar.itens) {
    const situacao =
      conta.situacao === "paga"
        ? `paga em ${dia(conta.pagaEm ?? conta.dia)}`
        : conta.pagaEm
          ? `paga depois, em ${dia(conta.pagaEm)}`
          : "em aberto";
    linha("Contas a pagar do mês", conta.descricao, conta.valorCentavos, {
      detalhe: `vence ${dia(conta.dia)} · ${situacao}${conta.categoria ? ` · ${conta.categoria}` : ""}`,
    });
  }
  linha("Contas a pagar do mês", "Pagas no mês", contasAPagar.pagas.totalCentavos, {
    quantidade: contasAPagar.pagas.quantidade,
  });
  linha("Contas a pagar do mês", "Em aberto no fim do mês", contasAPagar.emAberto.totalCentavos, {
    quantidade: contasAPagar.emAberto.quantidade,
  });
  linha("Contas a pagar do mês", "Total das contas do mês", contasAPagar.totalCentavos, {
    quantidade: contasAPagar.quantidade,
    destaque: true,
  });

  linha("Avisos", "Imposto", null, { detalhe: AVISO_DO_IMPOSTO });
  linha("Avisos", "Cobranças", null, { detalhe: AVISO_DAS_COBRANCAS });
  linha("Avisos", "Equipe", null, {
    detalhe: "Os pagamentos à equipe já estão nas saídas. O Bossa não faz folha de pagamento nem calcula encargos.",
  });

  return linhas;
}

// ---------------------------------------------------------------------------
// Dinheiro na borda
// ---------------------------------------------------------------------------

/**
 * Centavos para o número da célula do Excel, em reais. É a única conversão de
 * centavos para reais da planilha; a célula leva o formato de moeda.
 */
export function reaisDaCelula(centavos: number) {
  return centavos / 100;
}

/** Centavos para "1234,56" (sem milhar), do jeito que o Excel brasileiro lê o CSV. */
export function centavosNoCsv(centavos: number) {
  const negativo = centavos < 0;
  const absoluto = Math.abs(Math.trunc(centavos));
  const reais = Math.floor(absoluto / 100);
  const resto = String(absoluto % 100).padStart(2, "0");
  return `${negativo ? "-" : ""}${reais},${resto}`;
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

const BOM = "﻿";
const SEPARADOR = ";";

/**
 * Texto que o Excel leria como fórmula ("=", "+", "-", "@") ganha um apóstrofo
 * na frente. Uma descrição de despesa digitada como "=HIPERLINK(...)" não pode
 * virar link no computador do contador.
 */
export function textoSeguroNoCsv(texto: string) {
  const seguro = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[";\r\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

/** CSV no padrão brasileiro: ";" entre colunas, vírgula decimal, UTF-8 com BOM. */
export function planilhaEmCsv(linhas: LinhaDaPlanilha[]) {
  const corpo = [
    COLUNAS_DA_PLANILHA.join(SEPARADOR),
    ...linhas.map((linha) =>
      [
        textoSeguroNoCsv(linha.secao),
        textoSeguroNoCsv(linha.item),
        textoSeguroNoCsv(linha.detalhe),
        linha.quantidade === null ? "" : String(linha.quantidade),
        linha.valorCentavos === null ? "" : centavosNoCsv(linha.valorCentavos),
      ].join(SEPARADOR),
    ),
  ];
  return `${BOM}${corpo.join("\r\n")}\r\n`;
}

/** "relatorio-estudio-bela-2026-10.csv": só letras sem acento, números e hífen. */
export function nomeDoArquivo(nomeNegocio: string, mes: string, extensao: "csv" | "xlsx") {
  const base = nomeNegocio
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `relatorio-${base || "estudio"}-${mes}.${extensao}`;
}
