import { describe, expect, it } from "vitest";
import {
  competenciaAtual,
  dataCurta,
  dataPuraCurta,
  deDataPura,
  inicioDaCompetencia,
  inicioDoMes,
  inicioDoProximoMes,
  instanteDoDiaPuro,
  somarMeses,
  diferencaEmDias,
  hojeNoEstudio,
  paraDataPura,
  somarDiasPuros,
  ultimoDiaDoMes,
} from "@/lib/formato";

describe("datas puras", () => {
  it("vai e volta sem perder o dia", () => {
    const data = deDataPura("2026-10-05");
    expect(data).not.toBeNull();
    expect(paraDataPura(data!)).toBe("2026-10-05");
    expect(dataPuraCurta(data!)).toBe("05/10/2026");
  });

  it("não escorrega um dia por causa do fuso", () => {
    // Meia-noite em UTC é 21h do dia anterior em São Paulo. Se a conversão
    // passasse pelo fuso, este dia 1º viraria dia 31 do mês anterior.
    for (const dia of ["2026-01-01", "2026-03-01", "2026-12-31", "2026-02-28"]) {
      expect(paraDataPura(deDataPura(dia)!)).toBe(dia);
    }
  });

  it("recusa data que não existe", () => {
    expect(deDataPura("2026-02-31")).toBeNull();
    expect(deDataPura("2026-13-01")).toBeNull();
    expect(deDataPura("05/10/2026")).toBeNull();
    expect(deDataPura("")).toBeNull();
  });

  it("soma dias sem pular nem repetir, inclusive virando o mês e o ano", () => {
    expect(paraDataPura(somarDiasPuros(deDataPura("2026-10-05")!, 7))).toBe("2026-10-12");
    expect(paraDataPura(somarDiasPuros(deDataPura("2026-10-31")!, 1))).toBe("2026-11-01");
    expect(paraDataPura(somarDiasPuros(deDataPura("2026-12-31")!, 1))).toBe("2027-01-01");
    expect(paraDataPura(somarDiasPuros(deDataPura("2026-03-01")!, -1))).toBe("2026-02-28");
  });

  it("conta a diferença em dias", () => {
    const de = deDataPura("2026-10-05")!;
    expect(diferencaEmDias(de, deDataPura("2026-10-12")!)).toBe(7);
    expect(diferencaEmDias(de, deDataPura("2026-10-05")!)).toBe(0);
    expect(diferencaEmDias(de, deDataPura("2026-10-01")!)).toBe(-4);
  });

  it("sabe o último dia de cada mês, inclusive em ano bissexto", () => {
    expect(ultimoDiaDoMes(2026, 2)).toBe(28);
    expect(ultimoDiaDoMes(2028, 2)).toBe(29);
    expect(ultimoDiaDoMes(2026, 4)).toBe(30);
    expect(ultimoDiaDoMes(2026, 12)).toBe(31);
  });

  it("pega hoje pelo fuso do estúdio, não pelo do servidor", () => {
    // 23h30 em São Paulo do dia 5 é 02h30 em UTC do dia 6. O estúdio ainda
    // está no dia 5, e é esse o dia que vale.
    const quaseMeiaNoite = new Date("2026-10-06T02:30:00.000Z");
    expect(paraDataPura(hojeNoEstudio(quaseMeiaNoite))).toBe("2026-10-05");

    // E 21h01 em UTC do dia 5 já é 18h01 em São Paulo do mesmo dia 5.
    expect(paraDataPura(hojeNoEstudio(new Date("2026-10-05T21:01:00.000Z")))).toBe(
      "2026-10-05",
    );
  });
});

describe("começo do mês no fuso do estúdio", () => {
  it("o mês começa à meia-noite de São Paulo, não à de UTC", () => {
    // 23:30 do dia 31 em São Paulo já é dia 1º em UTC. Ainda é outubro.
    const fimDeOutubro = new Date("2026-11-01T02:30:00.000Z");
    expect(competenciaAtual(fimDeOutubro)).toBe("2026-10");
    expect(inicioDoMes(fimDeOutubro).toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(inicioDoProximoMes(fimDeOutubro).toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("vira o ano", () => {
    const reveillon = new Date("2027-01-01T02:59:00.000Z"); // 23:59 do dia 31 em SP
    expect(inicioDoMes(reveillon).toISOString()).toBe("2026-12-01T03:00:00.000Z");
    expect(inicioDoProximoMes(reveillon).toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("um helper só para o mês em texto", () => {
    expect(inicioDaCompetencia("2026-10").toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(somarMeses("2026-12", 1)).toBe("2027-01");
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
    expect(() => inicioDaCompetencia("2026-1")).toThrow();
  });
});

describe("dia puro que vira lançamento", () => {
  it("a conta paga no dia 10 aparece no dia 10, e não no dia 9", () => {
    const pagoEm = deDataPura("2026-10-10")!;
    // O erro antigo: o dia puro mostrado no fuso do estúdio volta um dia.
    expect(dataCurta(pagoEm)).toBe("09/10/2026");
    // O certo: meia-noite do dia 10 em São Paulo.
    expect(dataCurta(instanteDoDiaPuro(pagoEm))).toBe("10/10/2026");
    expect(instanteDoDiaPuro(pagoEm).toISOString()).toBe("2026-10-10T03:00:00.000Z");
  });

  it("o pagamento do dia 1º fica no mês certo", () => {
    const instante = instanteDoDiaPuro(deDataPura("2026-11-01")!);
    expect(instante.getTime()).toBeGreaterThanOrEqual(inicioDaCompetencia("2026-11").getTime());
  });
});
