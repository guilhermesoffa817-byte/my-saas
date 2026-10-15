import { describe, expect, it } from "vitest";
import {
  BOM,
  celula,
  dataCsv,
  dataPuraCsv,
  dinheiroCsv,
  horaCsv,
  linhaCsv,
  montarCsv,
  nomeDoArquivo,
} from "@/lib/csv";
import { deDataLocal, deDataPura, deHorarioLocal } from "@/lib/formato";

describe("célula", () => {
  it("texto simples sai do jeito que entrou", () => {
    expect(celula("Ana Paula")).toBe("Ana Paula");
    expect(celula("Conceição")).toBe("Conceição");
  });

  it("vazio sai vazio", () => {
    expect(celula(null)).toBe("");
    expect(celula(undefined)).toBe("");
    expect(celula("")).toBe("");
  });

  it("número vira texto", () => {
    expect(celula(42)).toBe("42");
  });

  it("ponto e vírgula dentro do texto vai entre aspas, senão viraria outra coluna", () => {
    expect(celula("Unha; pé e mão")).toBe('"Unha; pé e mão"');
  });

  it("aspas dentro do texto dobram", () => {
    expect(celula('Ana "Aninha" Souza')).toBe('"Ana ""Aninha"" Souza"');
  });

  it("quebra de linha fica dentro da célula", () => {
    expect(celula("Alergia a esmalte\nPrefere manhã")).toBe(
      '"Alergia a esmalte\nPrefere manhã"',
    );
    expect(celula("linha um\r\nlinha dois")).toBe('"linha um\r\nlinha dois"');
  });

  it("vírgula sozinha não precisa de aspas: o separador é o ponto e vírgula", () => {
    expect(celula("Rua das Flores, 120")).toBe("Rua das Flores, 120");
  });
});

describe("proteção contra fórmula", () => {
  it("o que começa com =, +, -, @, tab ou retorno ganha um apóstrofo", () => {
    expect(celula("=1+1")).toBe("'=1+1");
    expect(celula("+5566992513501")).toBe("'+5566992513501");
    expect(celula("-2+3")).toBe("'-2+3");
    expect(celula("@SOMA(A1:A9)")).toBe("'@SOMA(A1:A9)");
    expect(celula("\t=1+1")).toBe("'\t=1+1");
  });

  it("começar com retorno também protege, e a célula vai entre aspas", () => {
    expect(celula("\r=1+1")).toBe('"\'\r=1+1"');
  });

  it("o link escondido num nome de cliente não roda", () => {
    const nome = '=HIPERLINK("http://exemplo.com";"Clique")';
    expect(celula(nome)).toBe('"\'=HIPERLINK(""http://exemplo.com"";""Clique"")"');
  });

  it("um número negativo continua número", () => {
    expect(celula("-12,50")).toBe("-12,50");
    expect(celula(-3)).toBe("-3");
  });

  it("o sinal no meio do texto não incomoda", () => {
    expect(celula("Corte + escova")).toBe("Corte + escova");
    expect(celula("ana@estudio.com.br")).toBe("ana@estudio.com.br");
  });
});

describe("linha e arquivo", () => {
  it("as colunas se separam por ponto e vírgula", () => {
    expect(linhaCsv(["Ana", 120, null, "Corte"])).toBe("Ana;120;;Corte");
  });

  it("o arquivo começa com a marca BOM e termina cada linha em CRLF", () => {
    const csv = montarCsv(
      ["Nome", "Valor"],
      [
        ["Ana", "120,00"],
        ["Bia", "80,00"],
      ],
    );
    expect(csv.startsWith(BOM)).toBe(true);
    expect(BOM).toBe("﻿");
    expect(csv).toBe("﻿Nome;Valor\r\nAna;120,00\r\nBia;80,00\r\n");
  });

  it("sem registros, sai só o cabeçalho", () => {
    expect(montarCsv(["Nome"], [])).toBe("﻿Nome\r\n");
  });

  it("a quebra de linha dentro de uma célula não parte o registro", () => {
    const csv = montarCsv(["Nome", "Obs"], [["Ana", "uma\ndois"]]);
    expect(csv.split("\r\n")).toEqual(["﻿Nome;Obs", 'Ana;"uma\ndois"', ""]);
  });
});

describe("dinheiro", () => {
  it("vírgula nos centavos e nada de separador de milhar", () => {
    expect(dinheiroCsv(123456)).toBe("1234,56");
    expect(dinheiroCsv(12000)).toBe("120,00");
    expect(dinheiroCsv(5)).toBe("0,05");
    expect(dinheiroCsv(0)).toBe("0,00");
  });

  it("negativo leva o sinal", () => {
    expect(dinheiroCsv(-1250)).toBe("-12,50");
  });

  it("sem valor, célula vazia", () => {
    expect(dinheiroCsv(null)).toBe("");
    expect(dinheiroCsv(undefined)).toBe("");
  });
});

describe("datas", () => {
  it("um horário sai no dia de São Paulo, mesmo perto da meia-noite", () => {
    // 23h30 do dia 14 em São Paulo já é dia 15 em UTC.
    const tarde = deHorarioLocal("2026-10-14T23:30")!;
    expect(dataCsv(tarde)).toBe("14/10/2026");
    expect(horaCsv(tarde)).toBe("23:30");
  });

  it("o dia guardado como meia-noite de São Paulo continua o mesmo", () => {
    expect(dataCsv(deDataLocal("2026-03-01"))).toBe("01/03/2026");
  });

  it("data pura não escorrega para o dia anterior", () => {
    expect(dataPuraCsv(deDataPura("2026-10-10"))).toBe("10/10/2026");
    expect(dataPuraCsv(deDataPura("2026-01-01"))).toBe("01/01/2026");
  });

  it("sem data, célula vazia", () => {
    expect(dataCsv(null)).toBe("");
    expect(dataPuraCsv(undefined)).toBe("");
    expect(horaCsv(null)).toBe("");
  });
});

describe("nome do arquivo", () => {
  it("leva o tipo e o dia de hoje em São Paulo", () => {
    // 1h da manhã em UTC ainda é dia 14 em São Paulo.
    expect(nomeDoArquivo("clientes", new Date("2026-10-15T01:00:00.000Z"))).toBe(
      "bossa-clientes-2026-10-14.csv",
    );
  });

  it("não deixa passar nada que quebre o cabeçalho do download", () => {
    expect(nomeDoArquivo('cli"en\r\ntes/../', new Date("2026-10-14T15:00:00.000Z"))).toBe(
      "bossa-clientes-2026-10-14.csv",
    );
  });
});
