import { describe, expect, it } from "vitest";
import {
  calcularIndicadores,
  deslocarMes,
  dividirArredondando,
  dividirParaCima,
  montarResumoDeCustos,
  receitaDoMes,
  rotuloCurtoDoMes,
  rotuloDaOrigem,
  somarCustos,
  tendenciaDeSeisMeses,
  type DespesaParaCusto,
  type TotaisDeCustos,
} from "./calculo";

let sequencia = 0;
function despesa(dados: Partial<DespesaParaCusto> = {}): DespesaParaCusto {
  sequencia += 1;
  return {
    id: `d${sequencia}`,
    descricao: "Despesa",
    categoria: null,
    valorCentavos: 10_000,
    mes: "2026-10",
    dia: "2026-10-10",
    natureza: null,
    origem: null,
    motivo: null,
    daEquipe: false,
    ...dados,
  };
}

function totais(dados: Partial<TotaisDeCustos>): TotaisDeCustos {
  return {
    receitaCentavos: 0,
    fixosCentavos: 0,
    variaveisCentavos: 0,
    foraDaOperacaoCentavos: 0,
    semClassificacaoCentavos: 0,
    retiradasCentavos: 0,
    quantidadeSemClassificacao: 0,
    atendimentos: 0,
    ...dados,
  };
}

describe("somarCustos", () => {
  it("separa por natureza e deixa a retirada da dona de fora", () => {
    const lista = [
      despesa({ valorCentavos: 250_000, natureza: "fixo" }),
      despesa({ valorCentavos: 30_001, natureza: "variavel" }),
      despesa({ valorCentavos: 4_999, natureza: "nao_operacional" }),
      despesa({ valorCentavos: 1_234 }),
      despesa({ valorCentavos: 777 }),
      despesa({ valorCentavos: 500_000, descricao: "Retirada pessoal", natureza: "fixo" }),
      despesa({ valorCentavos: 300_000, descricao: "Pró-labore de outubro" }),
    ];
    expect(somarCustos({ despesas: lista, receitaCentavos: 900_000, atendimentos: 3 })).toEqual({
      receitaCentavos: 900_000,
      fixosCentavos: 250_000,
      variaveisCentavos: 30_001,
      foraDaOperacaoCentavos: 4_999,
      semClassificacaoCentavos: 2_011,
      retiradasCentavos: 800_000,
      quantidadeSemClassificacao: 2,
      atendimentos: 3,
    });
  });
});

describe("divisões inteiras", () => {
  it("arredonda para cima só quando sobra resto", () => {
    expect(dividirParaCima(BigInt(10), BigInt(5))).toBe(BigInt(2));
    expect(dividirParaCima(BigInt(11), BigInt(5))).toBe(BigInt(3));
    expect(dividirParaCima(BigInt(0), BigInt(5))).toBe(BigInt(0));
  });

  it("arredonda o meio para longe do zero, dos dois lados", () => {
    expect(dividirArredondando(BigInt(5), BigInt(2))).toBe(BigInt(3));
    expect(dividirArredondando(BigInt(-5), BigInt(2))).toBe(BigInt(-3));
    expect(dividirArredondando(BigInt(4), BigInt(3))).toBe(BigInt(1));
  });

  it("recusa divisor zero ou negativo", () => {
    expect(() => dividirParaCima(BigInt(1), BigInt(0))).toThrow();
    expect(() => dividirArredondando(BigInt(1), BigInt(-1))).toThrow();
  });
});

describe("calcularIndicadores", () => {
  it("calcula margem, sobra a cada R$ 100, peso dos fixos e ponto de equilíbrio", () => {
    // Receita R$ 10.000; variáveis R$ 3.000; fixos R$ 4.200; 50 atendimentos.
    const indicadores = calcularIndicadores(
      totais({ receitaCentavos: 1_000_000, variaveisCentavos: 300_000, fixosCentavos: 420_000, atendimentos: 50 }),
    );
    expect(indicadores.margemDeContribuicaoCentavos).toBe(700_000);
    expect(indicadores.indiceDeMargemPontosBase).toBe(7_000);
    // De cada R$ 100 (10.000 centavos) sobram R$ 70 (7.000 centavos).
    expect(indicadores.sobraACadaCemReaisCentavos).toBe(7_000);
    expect(indicadores.pesoDosFixosPontosBase).toBe(4_200);
    expect(indicadores.situacaoDoPontoDeEquilibrio).toBe("calculado");
    // 420.000 × 1.000.000 ÷ 700.000 = 600.000 (R$ 6.000), exato.
    expect(indicadores.pontoDeEquilibrioCentavos).toBe(600_000);
    // 420.000 × 50 ÷ 700.000 = 30 atendimentos.
    expect(indicadores.pontoDeEquilibrioAtendimentos).toBe(30);
  });

  it("com centavos ímpares, arredonda o ponto de equilíbrio para cima", () => {
    // 1.001 × 3.333 ÷ 2.222 = 1.501,5 → 1.502. Para baixo faltaria meio centavo.
    const indicadores = calcularIndicadores(
      totais({ receitaCentavos: 3_333, variaveisCentavos: 1_111, fixosCentavos: 1_001, atendimentos: 3 }),
    );
    expect(indicadores.margemDeContribuicaoCentavos).toBe(2_222);
    expect(indicadores.pontoDeEquilibrioCentavos).toBe(1_502);
    // 1.001 × 3 ÷ 2.222 = 1,35 → 2 atendimentos.
    expect(indicadores.pontoDeEquilibrioAtendimentos).toBe(2);
    // 2.222 ÷ 3.333 = 66,67% → 6.667 pontos-base.
    expect(indicadores.indiceDeMargemPontosBase).toBe(6_667);
  });

  it("com receita zero, não inventa margem nem ponto de equilíbrio", () => {
    const indicadores = calcularIndicadores(totais({ fixosCentavos: 180_000, variaveisCentavos: 20_000 }));
    expect(indicadores.indiceDeMargemPontosBase).toBeNull();
    expect(indicadores.sobraACadaCemReaisCentavos).toBeNull();
    expect(indicadores.pesoDosFixosPontosBase).toBeNull();
    expect(indicadores.situacaoDoPontoDeEquilibrio).toBe("sem_receita");
    expect(indicadores.pontoDeEquilibrioCentavos).toBeNull();
    expect(indicadores.margemDeContribuicaoCentavos).toBe(-20_000);
  });

  it("com margem negativa ou zero, o ponto de equilíbrio é null", () => {
    const negativa = calcularIndicadores(
      totais({ receitaCentavos: 100_000, variaveisCentavos: 120_000, fixosCentavos: 50_000 }),
    );
    expect(negativa.situacaoDoPontoDeEquilibrio).toBe("margem_insuficiente");
    expect(negativa.pontoDeEquilibrioCentavos).toBeNull();
    expect(negativa.pontoDeEquilibrioAtendimentos).toBeNull();
    expect(negativa.indiceDeMargemPontosBase).toBe(-2_000);

    const zero = calcularIndicadores(
      totais({ receitaCentavos: 100_000, variaveisCentavos: 100_000, fixosCentavos: 50_000 }),
    );
    expect(zero.situacaoDoPontoDeEquilibrio).toBe("margem_insuficiente");
    expect(zero.pontoDeEquilibrioCentavos).toBeNull();
  });

  it("sem custo fixo, não há o que cobrir", () => {
    const indicadores = calcularIndicadores(totais({ receitaCentavos: 100_000, variaveisCentavos: 10_000 }));
    expect(indicadores.situacaoDoPontoDeEquilibrio).toBe("sem_custos_fixos");
    expect(indicadores.pontoDeEquilibrioCentavos).toBeNull();
  });

  it("sem atendimento no mês, não estima equilíbrio em atendimentos", () => {
    const indicadores = calcularIndicadores(
      totais({ receitaCentavos: 100_000, variaveisCentavos: 10_000, fixosCentavos: 45_000 }),
    );
    expect(indicadores.pontoDeEquilibrioCentavos).toBe(50_000);
    expect(indicadores.pontoDeEquilibrioAtendimentos).toBeNull();
  });

  it("aguenta valores que estourariam o inteiro seguro na multiplicação", () => {
    // R$ 50 milhões × R$ 90 milhões, em centavos, passa de 2^53.
    const indicadores = calcularIndicadores(
      totais({ receitaCentavos: 9_000_000_000, variaveisCentavos: 4_000_000_001, fixosCentavos: 5_000_000_000 }),
    );
    expect(indicadores.pontoDeEquilibrioCentavos).toBe(9_000_000_002);
  });
});

describe("meses", () => {
  it("anda para frente e para trás atravessando o ano", () => {
    expect(deslocarMes("2026-01", -1)).toBe("2025-12");
    expect(deslocarMes("2026-12", 1)).toBe("2027-01");
    expect(deslocarMes("2026-10", -5)).toBe("2026-05");
    expect(deslocarMes("2026-03", -15)).toBe("2024-12");
  });

  it("escreve o mês curto em português", () => {
    expect(rotuloCurtoDoMes("2026-10")).toBe("out");
    expect(rotuloCurtoDoMes("2026-02")).toBe("fev");
  });
});

describe("receita e tendência", () => {
  it("soma a receita do mês e conta só os atendimentos", () => {
    const receitas = [
      { mes: "2026-10", valorCentavos: 12_000, atendimento: true },
      { mes: "2026-10", valorCentavos: 8_000, atendimento: true },
      { mes: "2026-10", valorCentavos: 5_000, atendimento: false },
      { mes: "2026-09", valorCentavos: 99_999, atendimento: true },
    ];
    expect(receitaDoMes(receitas, "2026-10")).toEqual({ receitaCentavos: 25_000, atendimentos: 2 });
  });

  it("monta seis meses de fixos e variáveis, sem retirada", () => {
    const tendencia = tendenciaDeSeisMeses(
      [
        despesa({ mes: "2026-10", natureza: "fixo", valorCentavos: 100 }),
        despesa({ mes: "2026-10", natureza: "variavel", valorCentavos: 50 }),
        despesa({ mes: "2026-05", natureza: "fixo", valorCentavos: 7 }),
        despesa({ mes: "2026-04", natureza: "fixo", valorCentavos: 999 }),
        despesa({ mes: "2026-10", descricao: "Retirada da dona", natureza: "fixo", valorCentavos: 5_000 }),
      ],
      "2026-10",
    );
    expect(tendencia.map((m) => m.mes)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(tendencia[0].fixosCentavos).toBe(7);
    expect(tendencia[5]).toMatchObject({ fixosCentavos: 100, variaveisCentavos: 50, rotulo: "out" });
  });
});

describe("montarResumoDeCustos", () => {
  it("junta o mês, compara com o anterior e lista as despesas maiores primeiro", () => {
    const resumo = montarResumoDeCustos({
      mes: "2026-10",
      despesas: [
        despesa({ mes: "2026-10", natureza: "fixo", valorCentavos: 180_000, descricao: "Aluguel" }),
        despesa({ mes: "2026-10", natureza: "variavel", valorCentavos: 20_000, descricao: "Produtos" }),
        despesa({ mes: "2026-10", valorCentavos: 9_000, descricao: "Lavanderia" }),
        despesa({ mes: "2026-10", valorCentavos: 300_000, descricao: "Retirada pessoal" }),
        despesa({ mes: "2026-09", natureza: "fixo", valorCentavos: 150_000, descricao: "Aluguel" }),
      ],
      receitas: [
        { mes: "2026-10", valorCentavos: 400_000, atendimento: true },
        { mes: "2026-09", valorCentavos: 350_000, atendimento: true },
      ],
    });
    expect(resumo.receitaCentavos).toBe(400_000);
    expect(resumo.fixosCentavos).toBe(180_000);
    expect(resumo.retiradasCentavos).toBe(300_000);
    expect(resumo.despesas.map((d) => d.descricao)).toEqual(["Aluguel", "Produtos", "Lavanderia"]);
    expect(resumo.mesAnterior).toMatchObject({
      mes: "2026-09",
      diferencaReceitaCentavos: 50_000,
      diferencaFixosCentavos: 30_000,
      diferencaVariaveisCentavos: 20_000,
      diferencaMargemCentavos: 30_000,
    });
  });
});

describe("rótulo da origem da classificação", () => {
  it("com a IA desligada, nenhuma origem fala de IA", () => {
    for (const origem of ["regra", "ia", "voce"] as const) {
      expect(rotuloDaOrigem(origem, false)).not.toMatch(/\bIA\b|intelig/i);
    }
    expect(rotuloDaOrigem("ia", false)).toBe("Sugestão automática");
  });

  it("com a IA ligada, diz de onde veio", () => {
    expect(rotuloDaOrigem("ia", true)).toBe("Sugestão da IA");
    expect(rotuloDaOrigem("regra", true)).toBe("Regra");
    expect(rotuloDaOrigem("voce", true)).toBe("Você");
  });
});
