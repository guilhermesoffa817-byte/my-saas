import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import {
  impostoEstimado,
  lerResumoGuardado,
  montarRelatorio,
  pendenciasDoRelatorio,
  referenciaDoMes,
  type DadosDoMes,
  type LancamentoDoMes,
} from "./montar";
import {
  centavosNoCsv,
  linhasDaPlanilha,
  nomeDoArquivo,
  planilhaEmCsv,
  reaisDaCelula,
  textoSeguroNoCsv,
} from "./planilha";
import { planilhaEmXlsx } from "./xlsx";

/** Um instante dado em horário de São Paulo (UTC-3, sem horário de verão). */
const sp = (texto: string) => new Date(`${texto}-03:00`);

const DEPOIS_DO_MES = sp("2026-11-10T10:00:00");

function lancamento(parcial: Partial<LancamentoDoMes> & Pick<LancamentoDoMes, "valorCentavos">): LancamentoDoMes {
  return {
    data: sp("2026-10-10T10:00:00"),
    tipo: "saida",
    descricao: "Despesa",
    categoria: null,
    natureza: null,
    deCobranca: false,
    pagamentoDaEquipe: null,
    ...parcial,
  };
}

function dados(parcial: Partial<DadosDoMes> = {}): DadosDoMes {
  return {
    mes: "2026-10",
    agora: DEPOIS_DO_MES,
    impostoPercentual: 6,
    atendimentos: [],
    lancamentos: [],
    cobrancas: [],
    contas: [],
    ...parcial,
  };
}

describe("relatório do mês: entradas", () => {
  it("soma em centavos inteiros e agrupa por serviço", () => {
    const relatorio = montarRelatorio(
      dados({
        atendimentos: [
          { inicio: sp("2026-10-02T09:00:00"), servico: "Corte", precoCentavos: 3333 },
          { inicio: sp("2026-10-03T09:00:00"), servico: "Corte", precoCentavos: 3333 },
          { inicio: sp("2026-10-04T09:00:00"), servico: "Escova", precoCentavos: 3334 },
        ],
      }),
    );
    expect(relatorio.entradas.atendimentos).toMatchObject({ quantidade: 3, totalCentavos: 10000 });
    expect(relatorio.entradas.atendimentos.porServico).toEqual([
      { rotulo: "Corte", quantidade: 2, totalCentavos: 6666 },
      { rotulo: "Escova", quantidade: 1, totalCentavos: 3334 },
    ]);
    expect(Number.isInteger(relatorio.entradas.totalCentavos)).toBe(true);
  });

  it("conta o mês no fuso do estúdio, não em UTC", () => {
    const relatorio = montarRelatorio(
      dados({
        atendimentos: [
          // 30/09 às 23h em São Paulo, mas já 1º/10 em UTC: é setembro.
          { inicio: new Date("2026-10-01T02:00:00Z"), servico: "Corte", precoCentavos: 5000 },
          // 31/10 às 23h59 em São Paulo, 1º/11 em UTC: é outubro.
          { inicio: new Date("2026-11-01T02:59:00Z"), servico: "Corte", precoCentavos: 7000 },
        ],
        lancamentos: [
          lancamento({ data: new Date("2026-10-01T02:30:00Z"), tipo: "entrada", valorCentavos: 900 }),
          lancamento({ data: new Date("2026-10-01T03:00:00Z"), tipo: "entrada", valorCentavos: 100 }),
        ],
      }),
    );
    expect(relatorio.entradas.atendimentos.totalCentavos).toBe(7000);
    expect(relatorio.entradas.manuais.totalCentavos).toBe(100);
  });

  it("não conta duas vezes a cobrança recebida", () => {
    const entradas = [
      lancamento({ tipo: "entrada", valorCentavos: 15000, categoria: "Venda de produto" }),
      // A entrada que nasceu de uma cobrança avulsa paga.
      lancamento({ tipo: "entrada", valorCentavos: 8000, categoria: "Cobrança", deCobranca: true }),
    ];
    const atendimentos = [{ inicio: sp("2026-10-05T10:00:00"), servico: "Manicure", precoCentavos: 4500 }];
    const relatorio = montarRelatorio(dados({ atendimentos, lancamentos: entradas }));

    expect(relatorio.entradas.manuais.totalCentavos).toBe(15000);
    expect(relatorio.entradas.cobrancasRecebidas).toEqual({ quantidade: 1, totalCentavos: 8000 });
    // O mesmo "Entrou" das Finanças: atendimentos mais todos os lançamentos de entrada.
    expect(relatorio.entradas.totalCentavos).toBe(4500 + 15000 + 8000);
  });
});

describe("relatório do mês: saídas, equipe e resultado", () => {
  const relatorio = montarRelatorio(
    dados({
      atendimentos: [{ inicio: sp("2026-10-05T10:00:00"), servico: "Corte", precoCentavos: 100001 }],
      lancamentos: [
        lancamento({ descricao: "Aluguel da sala", categoria: "Aluguel", valorCentavos: 180000, natureza: "fixo" }),
        lancamento({ descricao: "Esmaltes", categoria: "Material", valorCentavos: 23050, natureza: "variavel" }),
        lancamento({ descricao: "Juros do cartão", categoria: "", valorCentavos: 1999, natureza: "nao_operacional" }),
        lancamento({ descricao: "Retirada pessoal", categoria: "Retirada pessoal", valorCentavos: 50000 }),
        lancamento({ descricao: "Brindes", categoria: null, valorCentavos: 3000 }),
        lancamento({
          descricao: "Comissão — Juliana P.",
          categoria: "Comissões e repasses",
          valorCentavos: 40000,
          natureza: "variavel",
          pagamentoDaEquipe: "comissao",
        }),
        lancamento({
          descricao: "Salário — Rafael L.",
          categoria: "Salários e encargos",
          valorCentavos: 190000,
          natureza: "fixo",
          pagamentoDaEquipe: "salario",
        }),
      ],
    }),
  );

  it("separa por categoria e por natureza, com a retirada à parte", () => {
    expect(relatorio.saidas.totalCentavos).toBe(180000 + 23050 + 1999 + 50000 + 3000 + 40000 + 190000);
    expect(relatorio.saidas.porCategoria.find((linha) => linha.rotulo === "Sem categoria")).toMatchObject({
      quantidade: 2,
      totalCentavos: 1999 + 3000,
    });
    expect(relatorio.saidas.semCategoria).toBe(2);
    const natureza = Object.fromEntries(
      relatorio.saidas.porNatureza.map((linha) => [linha.grupo, linha.totalCentavos]),
    );
    expect(natureza).toEqual({
      fixo: 180000 + 190000,
      variavel: 23050 + 40000,
      nao_operacional: 1999,
      retirada: 50000,
      sem_classificacao: 3000,
    });
  });

  it("mostra a equipe por tipo, sem somar de novo nas saídas", () => {
    expect(relatorio.equipe.totalCentavos).toBe(230000);
    expect(relatorio.equipe.porTipo).toEqual([
      { rotulo: "Salário", quantidade: 1, totalCentavos: 190000 },
      { rotulo: "Comissão", quantidade: 1, totalCentavos: 40000 },
    ]);
  });

  it("calcula o resultado e o imposto estimado como as Finanças", () => {
    expect(relatorio.resultado.resultadoCentavos).toBe(100001 - relatorio.saidas.totalCentavos);
    // 6% de R$ 1.000,01 = R$ 60,0006: arredonda para 6000 centavos.
    expect(relatorio.resultado.impostoEstimadoCentavos).toBe(6000);
    expect(relatorio.resultado.depoisDoImpostoCentavos).toBe(
      relatorio.resultado.resultadoCentavos - 6000,
    );
    expect(impostoEstimado(-500, 6)).toBe(0);
    expect(impostoEstimado(12345, 0)).toBe(0);
  });

  it("o imposto aceita percentual com casas decimais, com a conta em centavos inteiros", () => {
    // 4,5% de R$ 1.000,00 = R$ 45,00 (antes o 4,5 virava 5 e dava R$ 50,00).
    expect(impostoEstimado(100000, 4.5)).toBe(4500);
    // 4,53% de R$ 1.234,56 = R$ 55,925568: arredonda para R$ 55,93.
    expect(impostoEstimado(123456, 4.53)).toBe(5593);
    expect(Number.isInteger(impostoEstimado(99999, 6.25))).toBe(true);
  });
});

describe("relatório do mês: cobranças e contas na virada", () => {
  const criada = sp("2026-09-20T10:00:00");

  it("separa em aberto e atrasadas na virada, e ignora pagas, canceladas e criadas depois", () => {
    const relatorio = montarRelatorio(
      dados({
        cobrancas: [
          { valorCentavos: 1000, vencimento: "2026-10-31", situacao: "aberta", pagaEm: null, criadaEm: criada },
          { valorCentavos: 2000, vencimento: "2026-11-05", situacao: "aberta", pagaEm: null, criadaEm: criada },
          // Paga só em novembro: estava em aberto (e atrasada) na virada.
          { valorCentavos: 4000, vencimento: "2026-10-10", situacao: "paga", pagaEm: "2026-11-01", criadaEm: criada },
          // Paga dentro de outubro: não estava em aberto.
          { valorCentavos: 8000, vencimento: "2026-10-10", situacao: "paga", pagaEm: "2026-10-31", criadaEm: criada },
          { valorCentavos: 16000, vencimento: "2026-10-10", situacao: "cancelada", pagaEm: null, criadaEm: criada },
          // Criada em novembro (01/11 00h30 em São Paulo): não existia em outubro.
          {
            valorCentavos: 32000,
            vencimento: "2026-10-30",
            situacao: "aberta",
            pagaEm: null,
            criadaEm: sp("2026-11-01T00:30:00"),
          },
        ],
      }),
    );
    expect(relatorio.referencia).toBe("2026-11-01");
    expect(relatorio.cobrancas.atrasadas).toEqual({ quantidade: 2, totalCentavos: 5000 });
    expect(relatorio.cobrancas.emAberto).toEqual({ quantidade: 1, totalCentavos: 2000 });
  });

  it("no mês que ainda corre, atrasada é o que venceu antes de hoje", () => {
    const relatorio = montarRelatorio(
      dados({
        agora: sp("2026-10-16T12:00:00"),
        cobrancas: [
          { valorCentavos: 1000, vencimento: "2026-10-15", situacao: "aberta", pagaEm: null, criadaEm: criada },
          { valorCentavos: 2000, vencimento: "2026-10-16", situacao: "aberta", pagaEm: null, criadaEm: criada },
          // Paga hoje: não está mais em aberto.
          { valorCentavos: 4000, vencimento: "2026-10-01", situacao: "paga", pagaEm: "2026-10-16", criadaEm: criada },
        ],
      }),
    );
    expect(relatorio.parcial).toBe(true);
    expect(relatorio.referencia).toBe("2026-10-16");
    expect(relatorio.cobrancas.atrasadas.totalCentavos).toBe(1000);
    expect(relatorio.cobrancas.emAberto.totalCentavos).toBe(2000);
  });

  it("lista as contas do mês e diz quais estavam pagas na virada", () => {
    const relatorio = montarRelatorio(
      dados({
        contas: [
          { descricao: "Aluguel", categoria: "Aluguel", valorCentavos: 180000, data: "2026-10-05", pago: true, pagoEm: "2026-10-05" },
          { descricao: "Energia", categoria: null, valorCentavos: 24000, data: "2026-10-20", pago: true, pagoEm: "2026-11-03" },
          { descricao: "Internet", categoria: null, valorCentavos: 9990, data: "2026-10-25", pago: false, pagoEm: null },
          { descricao: "Fora do mês", categoria: null, valorCentavos: 1, data: "2026-11-01", pago: false, pagoEm: null },
        ],
      }),
    );
    expect(relatorio.contasAPagar.itens.map((item) => [item.descricao, item.situacao])).toEqual([
      ["Aluguel", "paga"],
      ["Energia", "em_aberto"],
      ["Internet", "em_aberto"],
    ]);
    expect(relatorio.contasAPagar.pagas.totalCentavos).toBe(180000);
    expect(relatorio.contasAPagar.emAberto.totalCentavos).toBe(24000 + 9990);
    expect(relatorio.contasAPagar.totalCentavos).toBe(180000 + 24000 + 9990);
  });

  it("a referência é o dia 1º seguinte, contado em São Paulo", () => {
    expect(referenciaDoMes("2026-10", new Date("2026-11-01T02:00:00Z"))).toBe("2026-10-31");
    expect(referenciaDoMes("2026-10", new Date("2026-11-01T03:00:00Z"))).toBe("2026-11-01");
    expect(referenciaDoMes("2026-12", sp("2027-02-01T10:00:00"))).toBe("2027-01-01");
  });
});

describe("pendências e resumo guardado", () => {
  it("aponta o que falta antes de fechar", () => {
    const relatorio = montarRelatorio(
      dados({
        lancamentos: [lancamento({ valorCentavos: 500 })],
        cobrancas: [
          {
            valorCentavos: 1000,
            vencimento: "2026-10-01",
            situacao: "aberta",
            pagaEm: null,
            criadaEm: sp("2026-09-01T10:00:00"),
          },
        ],
        contas: [{ descricao: "Luz", categoria: null, valorCentavos: 300, data: "2026-10-10", pago: false, pagoEm: null }],
      }),
    );
    const pendencias = Object.fromEntries(
      pendenciasDoRelatorio(relatorio).map((item) => [item.chave, item.quantidade]),
    );
    expect(pendencias).toEqual({
      "cobrancas-atrasadas": 1,
      "contas-em-aberto": 1,
      "despesas-sem-categoria": 1,
      "sem-classificacao": 1,
    });
  });

  it("o relatório volta igual depois de passar pelo JSON do banco", () => {
    const relatorio = montarRelatorio(
      dados({ atendimentos: [{ inicio: sp("2026-10-05T10:00:00"), servico: "Corte", precoCentavos: 4500 }] }),
    );
    const guardado = lerResumoGuardado(JSON.parse(JSON.stringify(relatorio)));
    expect(guardado).toEqual(relatorio);
    expect(lerResumoGuardado({ versao: 99 })).toBeNull();
    expect(lerResumoGuardado(null)).toBeNull();
  });
});

describe("planilha", () => {
  const relatorio = montarRelatorio(
    dados({
      atendimentos: [{ inicio: sp("2026-10-05T10:00:00"), servico: "Corte; feminino", precoCentavos: 123456 }],
      lancamentos: [lancamento({ descricao: "x", categoria: "=HIPERLINK(\"http://x\")", valorCentavos: 5 })],
    }),
  );
  const linhas = linhasDaPlanilha(relatorio, {
    nomeNegocio: "Estúdio Bela",
    situacao: "Em aberto",
    geradoEm: "16/10/2026 às 10:00",
  });

  it("escreve centavos como texto brasileiro sem passar por número quebrado", () => {
    expect(centavosNoCsv(123456)).toBe("1234,56");
    expect(centavosNoCsv(5)).toBe("0,05");
    expect(centavosNoCsv(-12345)).toBe("-123,45");
    expect(centavosNoCsv(0)).toBe("0,00");
    expect(reaisDaCelula(123456)).toBe(1234.56);
  });

  it("o CSV abre no Excel brasileiro e não deixa texto virar fórmula", () => {
    const csv = planilhaEmCsv(linhas);
    expect(csv.startsWith("﻿Seção;Item;Detalhe;Quantidade;Valor (R$)\r\n")).toBe(true);
    expect(csv).toContain('Entradas por serviço;"Corte; feminino";;1;1234,56');
    expect(csv).toContain(`"'=HIPERLINK(""http://x"")"`);
    expect(textoSeguroNoCsv("+55 66")).toBe("'+55 66");
    expect(textoSeguroNoCsv("Aluguel")).toBe("Aluguel");
  });

  it("o Excel traz o valor numérico em reais, com formato de moeda", async () => {
    const arquivo = await planilhaEmXlsx(linhas, "Relatório 2026-10");
    const livro = new ExcelJS.Workbook();
    await livro.xlsx.load(arquivo as unknown as ArrayBuffer);
    const aba = livro.worksheets[0];
    let achou = false;
    aba.eachRow((linha) => {
      if (linha.getCell(2).value === "Total de entradas") {
        expect(linha.getCell(5).value).toBe(1234.56);
        expect(linha.getCell(5).numFmt).toContain("R$");
        achou = true;
      }
    });
    expect(achou).toBe(true);
  });

  it("nome do arquivo sem acento nem espaço", () => {
    expect(nomeDoArquivo("Estúdio Bela & Cia.", "2026-10", "csv")).toBe(
      "relatorio-estudio-bela-cia-2026-10.csv",
    );
  });
});
