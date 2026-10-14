import { describe, expect, it } from "vitest";
import {
  MAIOR_LANCAMENTO_CENTAVOS,
  buscaDosLancamentos,
  diaDoLancamento,
  escolherMes,
  lancamentoDoMes,
  lancamentoEmReais,
  lerPercentual,
  lerValor,
  limitesDoMes,
  mesMaisAntigo,
  mesValido,
  nomeDoMes,
  porDiaDaSemana,
  resumoDoMes,
  saldoEmReais,
  somarMeses,
} from "./financas";

describe("o mês da URL", () => {
  it("aceita só AAAA-MM com mês de verdade", () => {
    expect(mesValido("2026-10")).toBe(true);
    expect(mesValido("2026-01")).toBe(true);
    expect(mesValido("2026-13")).toBe(false);
    expect(mesValido("2026-00")).toBe(false);
    expect(mesValido("2026-1")).toBe(false);
    expect(mesValido("2026-10-01")).toBe(false);
    expect(mesValido("outubro")).toBe(false);
    expect(mesValido(["2026-10"])).toBe(false);
    expect(mesValido(undefined)).toBe(false);
  });

  it("anda para trás e para a frente, virando o ano", () => {
    expect(somarMeses("2026-10", -1)).toBe("2026-09");
    expect(somarMeses("2026-10", 1)).toBe("2026-11");
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
    expect(somarMeses("2026-12", 1)).toBe("2027-01");
    expect(somarMeses("2026-03", -15)).toBe("2024-12");
  });

  it("nunca passa do mês atual nem volta antes do primeiro", () => {
    const limites = { atual: "2026-10", primeiro: "2026-03" };
    expect(escolherMes("2026-09", limites)).toBe("2026-09");
    expect(escolherMes("2026-10", limites)).toBe("2026-10");
    expect(escolherMes("2026-11", limites)).toBe("2026-10");
    expect(escolherMes("2030-01", limites)).toBe("2026-10");
    expect(escolherMes("2026-01", limites)).toBe("2026-03");
    expect(escolherMes("1999-01", limites)).toBe("2026-03");
  });

  it("cai no mês atual quando o pedido não serve", () => {
    const limites = { atual: "2026-10", primeiro: "2026-03" };
    expect(escolherMes(undefined, limites)).toBe("2026-10");
    expect(escolherMes("", limites)).toBe("2026-10");
    expect(escolherMes("2026-13", limites)).toBe("2026-10");
    expect(escolherMes("lixo", limites)).toBe("2026-10");
  });

  it("um primeiro mês no futuro não esconde o mês atual", () => {
    expect(escolherMes("2026-10", { atual: "2026-10", primeiro: "2026-12" })).toBe("2026-10");
  });

  it("acha o mês mais antigo, ignorando o que não é mês", () => {
    expect(mesMaisAntigo(["2026-10", null, "2025-12", undefined, "2026-01"])).toBe("2025-12");
    expect(mesMaisAntigo([null, "lixo"])).toBeNull();
  });

  it("escreve o nome do mês, com o ano só quando é outro", () => {
    expect(nomeDoMes("2026-09", 2026)).toBe("setembro");
    expect(nomeDoMes("2025-12", 2026)).toBe("dezembro de 2025");
    expect(nomeDoMes("2026-03")).toBe("março de 2026");
  });
});

describe("limites do mês em São Paulo", () => {
  it("começa à meia-noite de São Paulo, não à de Greenwich", () => {
    const { inicio, fim } = limitesDoMes("2026-10");
    expect(inicio.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("vira o ano em dezembro", () => {
    const { inicio, fim } = limitesDoMes("2026-12");
    expect(inicio.toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(fim.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("o atendimento das 22h do último dia fica no mês dele", () => {
    // 30 de setembro às 22h em São Paulo já é 1º de outubro em Greenwich.
    const atendimento = new Date("2026-10-01T01:00:00.000Z");
    const setembro = limitesDoMes("2026-09");
    const outubro = limitesDoMes("2026-10");
    expect(atendimento >= setembro.inicio && atendimento < setembro.fim).toBe(true);
    expect(atendimento >= outubro.inicio && atendimento < outubro.fim).toBe(false);
  });
});

describe("o dia de um lançamento", () => {
  it("lê a data pura das cobranças e vencimentos sem perder um dia", () => {
    expect(diaDoLancamento(new Date("2026-10-01T00:00:00.000Z"))).toBe("2026-10-01");
    expect(diaDoLancamento(new Date("2026-10-31T00:00:00.000Z"))).toBe("2026-10-31");
  });

  it("lê a meia-noite de São Paulo do formulário das Finanças", () => {
    expect(diaDoLancamento(new Date("2026-10-01T03:00:00.000Z"))).toBe("2026-10-01");
  });

  it("lê qualquer outro instante no fuso do estúdio", () => {
    // 22h do dia 31 em São Paulo.
    expect(diaDoLancamento(new Date("2026-11-01T01:00:00.000Z"))).toBe("2026-10-31");
  });

  it("sabe de que mês o lançamento é, nas duas pontas", () => {
    expect(lancamentoDoMes(new Date("2026-10-01T00:00:00.000Z"), "2026-10")).toBe(true);
    expect(lancamentoDoMes(new Date("2026-11-01T00:00:00.000Z"), "2026-10")).toBe(false);
    expect(lancamentoDoMes(new Date("2026-11-01T03:00:00.000Z"), "2026-10")).toBe(false);
    expect(lancamentoDoMes(new Date("2026-09-30T03:00:00.000Z"), "2026-10")).toBe(false);
  });

  it("a busca no banco cobre os dois jeitos de gravar o dia 1º", () => {
    const { inicio, fim } = buscaDosLancamentos("2026-10");
    const puraDoDia1 = new Date("2026-10-01T00:00:00.000Z");
    const localDoUltimoDia = new Date("2026-10-31T03:00:00.000Z");
    expect(puraDoDia1 >= inicio && puraDoDia1 < fim).toBe(true);
    expect(localDoUltimoDia >= inicio && localDoUltimoDia < fim).toBe(true);
    // A meia-noite de São Paulo do mês seguinte já fica de fora.
    expect(new Date("2026-11-01T03:00:00.000Z") < fim).toBe(false);
  });
});

describe("resumo do mês", () => {
  const servico = { precoCentavos: 15000 };

  it("usa o valor combinado no atendimento, e o preço do serviço só nos antigos", () => {
    const resumo = resumoDoMes({
      atendimentos: [
        { valorCentavos: 12000, servico },
        { valorCentavos: null, servico },
      ],
      lancamentos: [],
      impostoPercentual: 0,
    });
    expect(resumo.atendimentosCentavos).toBe(27000);
  });

  it("soma entradas, despesas, imposto e o que sobrou", () => {
    const resumo = resumoDoMes({
      atendimentos: [{ valorCentavos: 10000, servico }],
      lancamentos: [
        { tipo: "entrada", valorCentavos: 5000 },
        { tipo: "saida", valorCentavos: 3000 },
        { tipo: "saida", valorCentavos: 2000 },
      ],
      impostoPercentual: 6,
    });
    expect(resumo.entradasManuais).toBe(5000);
    expect(resumo.entradas).toBe(15000);
    expect(resumo.saidas).toBe(5000);
    expect(resumo.quantasDespesas).toBe(2);
    expect(resumo.imposto).toBe(900);
    expect(resumo.sobrou).toBe(15000 - 5000 - 900);
  });

  it("deixa o mês ficar negativo quando a despesa passa da entrada", () => {
    const resumo = resumoDoMes({
      atendimentos: [],
      lancamentos: [{ tipo: "saida", valorCentavos: 80000 }],
      impostoPercentual: 6,
    });
    expect(resumo.sobrou).toBe(-80000);
  });
});

describe("dias da semana", () => {
  it("põe cada atendimento no dia de São Paulo, de segunda a domingo", () => {
    const dias = porDiaDaSemana([
      // Segunda, 12 de outubro, 10h em São Paulo.
      { inicio: new Date("2026-10-12T13:00:00.000Z"), valorCentavos: 10000, servico: { precoCentavos: 1 } },
      // Domingo, 11 de outubro, 22h em São Paulo, que já é segunda em Greenwich.
      { inicio: new Date("2026-10-12T01:00:00.000Z"), valorCentavos: null, servico: { precoCentavos: 7000 } },
    ]);

    expect(dias).toHaveLength(7);
    expect(dias[0].nomeCompleto).toBe("Segunda-feira");
    expect(dias[0].centavos).toBe(10000);
    expect(dias[0].atendimentos).toBe(1);
    expect(dias[6].nomeCompleto).toBe("Domingo");
    expect(dias[6].centavos).toBe(7000);
    expect(new Set(dias.map((dia) => dia.rotulo)).size).toBe(7);
  });
});

describe("valores escritos", () => {
  it("o saldo negativo é um texto só, com o sinal de menos colado", () => {
    const negativo = saldoEmReais(-12050);
    expect(negativo.startsWith("−R$")).toBe(true);
    expect(negativo).toContain("120,50");
    expect(negativo).not.toMatch(/ /);
    expect(saldoEmReais(12050)).not.toContain("−");
  });

  it("o lançamento leva o sinal sem espaço que quebre a linha", () => {
    expect(lancamentoEmReais("entrada", 15000).startsWith("+ R$")).toBe(true);
    expect(lancamentoEmReais("saida", 15000).startsWith("− R$")).toBe(true);
    expect(lancamentoEmReais("saida", 15000)).not.toMatch(/ /);
  });
});

describe("o que vem do formulário", () => {
  it("lê o valor do jeito que se escreve no Brasil", () => {
    expect(lerValor("150")).toBe(15000);
    expect(lerValor("150,5")).toBe(15050);
    expect(lerValor("1.234,56")).toBe(123456);
    expect(lerValor("R$ 1.234,56")).toBe(123456);
    expect(lerValor("1234.56")).toBe(123456);
    expect(lerValor("1.500")).toBe(150000);
    expect(lerValor("12.500.000")).toBeNull();
  });

  it("recusa zero, negativo, texto e valor alto demais", () => {
    expect(lerValor("0")).toBeNull();
    expect(lerValor("0,00")).toBeNull();
    expect(lerValor("-10")).toBeNull();
    expect(lerValor("dez reais")).toBeNull();
    expect(lerValor("")).toBeNull();
    expect(lerValor("1,2,3")).toBeNull();
    expect(lerValor("10,999")).toBeNull();
    expect(lerValor("1.000.000,01")).toBeNull();
    expect(lerValor("1.000.000,00")).toBe(MAIOR_LANCAMENTO_CENTAVOS);
  });

  it("lê o percentual do imposto, inteiro de 0 a 100", () => {
    expect(lerPercentual("6")).toBe(6);
    expect(lerPercentual("6%")).toBe(6);
    expect(lerPercentual(" 6 % ")).toBe(6);
    expect(lerPercentual("4,5")).toBe(5);
    expect(lerPercentual("0")).toBe(0);
    expect(lerPercentual("100")).toBe(100);
  });

  it("recusa percentual vazio, negativo ou acima de 100", () => {
    expect(lerPercentual("")).toBeNull();
    expect(lerPercentual("%")).toBeNull();
    expect(lerPercentual("-1")).toBeNull();
    expect(lerPercentual("101")).toBeNull();
    expect(lerPercentual("seis")).toBeNull();
  });
});
