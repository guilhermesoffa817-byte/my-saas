/**
 * As mesmas linhas do CSV, em Excel: dinheiro em coluna de moeda, totais em
 * negrito e a primeira linha presa no topo ao rolar.
 */
import ExcelJS from "exceljs";
import {
  COLUNAS_DA_PLANILHA,
  reaisDaCelula,
  type LinhaDaPlanilha,
} from "./planilha";

const AZUL = "FF1D4ED8";
const BRANCO = "FFFFFFFF";
const MOEDA = '"R$" #,##0.00;-"R$" #,##0.00';

export async function planilhaEmXlsx(linhas: LinhaDaPlanilha[], titulo: string) {
  const livro = new ExcelJS.Workbook();
  livro.creator = "Bossa";
  // A data do arquivo não carrega informação nenhuma do estúdio.
  livro.created = new Date();

  // O Excel recusa nome de aba com mais de 31 letras ou com / \ ? * [ ].
  const aba = livro.addWorksheet(titulo.replace(/[\\/?*[\]:]/g, " ").slice(0, 31), {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  aba.columns = [
    { width: 34 },
    { width: 38 },
    { width: 52 },
    { width: 12 },
    { width: 16 },
  ];

  const cabecalho = aba.addRow([...COLUNAS_DA_PLANILHA]);
  cabecalho.font = { bold: true, color: { argb: BRANCO } };
  cabecalho.eachCell((celula) => {
    celula.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  });

  for (const linha of linhas) {
    const criada = aba.addRow([
      linha.secao,
      linha.item,
      linha.detalhe || null,
      linha.quantidade,
      linha.valorCentavos === null ? null : reaisDaCelula(linha.valorCentavos),
    ]);
    criada.getCell(5).numFmt = MOEDA;
    criada.getCell(3).alignment = { wrapText: true, vertical: "top" };
    if (linha.destaque) criada.font = { bold: true };
  }

  const conteudo = await livro.xlsx.writeBuffer();
  return Buffer.from(conteudo);
}
