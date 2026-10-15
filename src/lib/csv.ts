/**
 * Planilhas para baixar, do jeito que o Excel brasileiro abre sem susto.
 *
 * O Excel em português espera ponto e vírgula entre as colunas, porque a
 * vírgula é a dos centavos. Sem a marca BOM no começo, ele lê os acentos como
 * se fossem de outra codificação e "Conceição" vira "ConceiÃ§Ã£o". As linhas
 * terminam em CRLF, que é o fim de linha que ele conhece.
 *
 * Tem também uma proteção que não aparece: célula que começa com =, +, -, @,
 * tab ou retorno vira fórmula quando a planilha abre. Um cliente cadastrado com
 * o nome "=HIPERLINK(...)" faria o computador de quem abriu o arquivo seguir um
 * link sem perceber. Essas células ganham um apóstrofo na frente e viram texto.
 */

import { dataCurta, dataPuraCurta, hora, paraDataLocal } from "@/lib/formato";

export const BOM = "﻿";
export const SEPARADOR = ";";
export const FIM_DE_LINHA = "\r\n";

/** Texto, número contado pelo Bossa, ou vazio. */
export type Celula = string | number | null | undefined;

const COMECO_DE_FORMULA = /^[=+\-@\t\r]/;

/** "-12,50" é só um número negativo: não roda nada e precisa continuar somável. */
const NUMERO_PURO = /^-?\d+(,\d+)?$/;

/** Uma célula pronta para entrar na linha: protegida e, se preciso, entre aspas. */
export function celula(valor: Celula): string {
  if (valor === null || valor === undefined) return "";

  let texto = String(valor);
  if (COMECO_DE_FORMULA.test(texto) && !NUMERO_PURO.test(texto)) texto = `'${texto}`;

  // Aspas, separador ou quebra de linha dentro do texto: a célula vai entre
  // aspas, e as aspas de dentro dobram. É a regra que o Excel segue para ler.
  if (/[";\r\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

export function linhaCsv(celulas: Celula[]) {
  return celulas.map(celula).join(SEPARADOR);
}

/** O arquivo inteiro: marca BOM, cabeçalho e uma linha por registro. */
export function montarCsv(cabecalho: string[], linhas: Celula[][]) {
  const corpo = [cabecalho, ...linhas].map(linhaCsv).join(FIM_DE_LINHA);
  return `${BOM}${corpo}${FIM_DE_LINHA}`;
}

/**
 * Centavos como o Excel brasileiro entende número: "1234,56", sem separador
 * de milhar e sem "R$", para a coluna continuar somável.
 */
export function dinheiroCsv(centavos: number | null | undefined) {
  if (centavos === null || centavos === undefined) return "";
  const sinal = centavos < 0 ? "-" : "";
  const absoluto = Math.abs(Math.round(centavos));
  const reais = Math.floor(absoluto / 100);
  const resto = String(absoluto % 100).padStart(2, "0");
  return `${sinal}${reais},${resto}`;
}

/** Um instante (horário marcado, dia do cadastro) como dd/mm/aaaa em São Paulo. */
export function dataCsv(data: Date | null | undefined) {
  return data ? dataCurta(data) : "";
}

/**
 * Uma data pura (vencimento, dia do pagamento) como dd/mm/aaaa. Não passa por
 * fuso nenhum: o vencimento do dia 10 sai dia 10, e não dia 9.
 */
export function dataPuraCsv(data: Date | null | undefined) {
  return data ? dataPuraCurta(data) : "";
}

/** A hora de um horário marcado, em São Paulo. */
export function horaCsv(data: Date | null | undefined) {
  return data ? hora(data) : "";
}

/** "bossa-clientes-2026-10-14.csv". O dia é o de hoje em São Paulo. */
export function nomeDoArquivo(tipo: string, agora = new Date()) {
  const limpo = tipo.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return `bossa-${limpo}-${paraDataLocal(agora)}.csv`;
}
