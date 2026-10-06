import { describe, expect, it } from "vitest";
import {
  dataPuraCurta,
  deDataPura,
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
