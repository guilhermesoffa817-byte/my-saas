import { describe, expect, it } from "vitest";
import { hora, paraHorarioLocal } from "@/lib/formato";
import {
  diaDaSemanaDoDia,
  diasDaJanela,
  escolherQuemAtende,
  faixasDoDia,
  horaParaMinutos,
  horariosLivres,
  horariosLivresDasAgendas,
  instanteNoDia,
  minutosParaHora,
} from "./disponibilidade";

/** "09:00" no fuso de São Paulo, para comparar sem pensar em UTC. */
const horas = (lista: Date[]) => lista.map(hora);
const sp = (texto: string) => new Date(`${texto}:00-03:00`);
const longe = sp("2026-10-01T08:00");
const manha = { inicioMin: 9 * 60, fimMin: 12 * 60 };
const tarde = { inicioMin: 13 * 60, fimMin: 18 * 60 };

describe("horários livres de uma agenda", () => {
  it("anda de 30 em 30 minutos e respeita o almoço", () => {
    const livres = horariosLivres({
      dia: "2026-10-19",
      faixas: [manha, tarde],
      ocupados: [],
      duracaoMin: 60,
      agora: longe,
      antecedenciaMin: 0,
    });
    expect(horas(livres)).toEqual([
      "09:00", "09:30", "10:00", "10:30", "11:00",
      "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00",
    ]);
  });

  it("só oferece o horário em que o serviço inteiro cabe antes de fechar", () => {
    const livres = horariosLivres({
      dia: "2026-10-19",
      faixas: [{ inicioMin: 9 * 60, fimMin: 10 * 60 + 30 }],
      ocupados: [],
      duracaoMin: 60,
      agora: longe,
      antecedenciaMin: 0,
    });
    // 10:00 terminaria 11:00, depois do fechamento das 10:30.
    expect(horas(livres)).toEqual(["09:00", "09:30"]);
  });

  it("não oferece horário que esbarra num atendimento marcado", () => {
    const livres = horariosLivres({
      dia: "2026-10-19",
      faixas: [manha],
      ocupados: [{ inicio: sp("2026-10-19T10:00"), fim: sp("2026-10-19T11:00") }],
      duracaoMin: 60,
      agora: longe,
      antecedenciaMin: 0,
    });
    // 09:30 iria até 10:30 e 10:30 começa antes das 11:00: os dois caem.
    expect(horas(livres)).toEqual(["09:00", "11:00"]);
  });

  it("encosta no atendimento sem se chocar com ele", () => {
    const livres = horariosLivres({
      dia: "2026-10-19",
      faixas: [manha],
      ocupados: [{ inicio: sp("2026-10-19T09:00"), fim: sp("2026-10-19T09:30") }],
      duracaoMin: 30,
      agora: longe,
      antecedenciaMin: 0,
    });
    expect(horas(livres)[0]).toBe("09:30");
  });

  it("guarda a antecedência mínima a partir de agora", () => {
    const livres = horariosLivres({
      dia: "2026-10-19",
      faixas: [manha],
      ocupados: [],
      duracaoMin: 60,
      agora: sp("2026-10-19T08:10"),
      antecedenciaMin: 120,
    });
    // Agora 08:10 + 2 h = 10:10. O primeiro horário possível é 10:30.
    expect(horas(livres)).toEqual(["10:30", "11:00"]);
  });

  it("não oferece horário que já passou, mesmo sem antecedência", () => {
    const livres = horariosLivres({
      dia: "2026-10-19",
      faixas: [tarde],
      ocupados: [],
      duracaoMin: 60,
      agora: sp("2026-10-19T15:05"),
      antecedenciaMin: 0,
    });
    expect(horas(livres)).toEqual(["15:30", "16:00", "16:30", "17:00"]);
  });

  it("usa o fuso de São Paulo, e não o do servidor", () => {
    const [primeiro] = horariosLivres({
      dia: "2026-10-19",
      faixas: [manha],
      ocupados: [],
      duracaoMin: 60,
      agora: longe,
      antecedenciaMin: 0,
    });
    // 09:00 em São Paulo (UTC-3) é 12:00 em UTC.
    expect(primeiro.toISOString()).toBe("2026-10-19T12:00:00.000Z");
  });

  it("vira o dia: quem atende até a meia-noite oferece o horário das 23h", () => {
    const livres = horariosLivres({
      dia: "2026-10-19",
      faixas: [{ inicioMin: 22 * 60, fimMin: 24 * 60 }],
      ocupados: [],
      duracaoMin: 60,
      agora: longe,
      antecedenciaMin: 0,
    });
    expect(horas(livres)).toEqual(["22:00", "22:30", "23:00"]);
    // 23:00 do dia 19 em São Paulo já é dia 20 em UTC.
    expect(livres[2].toISOString()).toBe("2026-10-20T02:00:00.000Z");
    expect(paraHorarioLocal(livres[2])).toBe("2026-10-19T23:00");
  });

  it("o atendimento da noite anterior que passa da meia-noite ocupa o começo do dia", () => {
    const livres = horariosLivres({
      dia: "2026-10-20",
      faixas: [{ inicioMin: 0, fimMin: 2 * 60 }],
      ocupados: [{ inicio: sp("2026-10-19T23:30"), fim: sp("2026-10-20T00:30") }],
      duracaoMin: 30,
      agora: longe,
      antecedenciaMin: 0,
    });
    expect(horas(livres)).toEqual(["00:30", "01:00", "01:30"]);
  });

  it("dia fechado não tem horário", () => {
    expect(
      horariosLivres({
        dia: "2026-10-18",
        faixas: [],
        ocupados: [],
        duracaoMin: 30,
        agora: longe,
        antecedenciaMin: 0,
      }),
    ).toEqual([]);
  });
});

describe("dias e semana", () => {
  it("sabe o dia da semana do dia de calendário", () => {
    expect(diaDaSemanaDoDia("2026-10-18")).toBe(0); // domingo
    expect(diaDaSemanaDoDia("2026-10-19")).toBe(1); // segunda
    expect(diaDaSemanaDoDia("2026-10-24")).toBe(6); // sábado
  });

  it("a janela começa no hoje de São Paulo, mesmo quando em UTC já é amanhã", () => {
    // 23:30 do dia 15 em São Paulo é 02:30 do dia 16 em UTC.
    const dias = diasDaJanela(new Date("2026-10-16T02:30:00.000Z"), 3);
    expect(dias).toEqual(["2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18"]);
  });

  it("a janela vira o mês e o ano sem pular dia", () => {
    expect(diasDaJanela(sp("2026-12-30T10:00"), 2)).toEqual([
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
    ]);
  });

  it("separa as faixas do dia certo, em ordem", () => {
    const faixas = [
      { diaDaSemana: 1, ...tarde },
      { diaDaSemana: 1, ...manha },
      { diaDaSemana: 2, ...manha },
    ];
    expect(faixasDoDia(faixas, "2026-10-19")).toEqual([manha, tarde]);
    expect(faixasDoDia(faixas, "2026-10-18")).toEqual([]);
  });

  it("converte hora e minuto nos dois sentidos", () => {
    expect(horaParaMinutos("09:30")).toBe(570);
    expect(horaParaMinutos("24:00")).toBe(1440);
    expect(horaParaMinutos("24:30")).toBeNull();
    expect(horaParaMinutos("9:30")).toBeNull();
    expect(minutosParaHora(570)).toBe("09:30");
    expect(instanteNoDia("2026-10-19", 1440).toISOString()).toBe("2026-10-20T03:00:00.000Z");
  });
});

describe("horários com equipe", () => {
  const dia = "2026-10-19";
  const ana = {
    id: "ana",
    ocupados: [{ inicio: sp("2026-10-19T09:00"), fim: sp("2026-10-19T10:00") }],
    fora: () => false,
  };
  const bia = { id: "bia", ocupados: [], fora: () => false };
  const dona = { id: null, ocupados: [], fora: (d: string) => d === "2026-10-19" };

  it("cada horário diz quem está livre nele", () => {
    const horarios = horariosLivresDasAgendas({
      dia,
      faixas: [{ inicioMin: 9 * 60, fimMin: 11 * 60 }],
      agendas: [dona, ana, bia],
      duracaoMin: 60,
      agora: longe,
      antecedenciaMin: 0,
    });
    expect(horarios.map((h) => [hora(h.inicio), h.livres])).toEqual([
      ["09:00", ["bia"]],
      ["09:30", ["bia"]],
      ["10:00", ["ana", "bia"]],
    ]);
  });

  it("quem está fora no dia não oferece nada", () => {
    const horarios = horariosLivresDasAgendas({
      dia,
      faixas: [manha],
      agendas: [dona],
      duracaoMin: 60,
      agora: longe,
      antecedenciaMin: 0,
    });
    expect(horarios).toEqual([]);
  });

  it("escolhe a pessoa pedida só se ela estiver livre; tanto faz fica com a primeira", () => {
    expect(escolherQuemAtende(["ana", "bia"], { qualquer: true })).toBe("ana");
    expect(escolherQuemAtende(["bia"], { id: "bia" })).toBe("bia");
    expect(escolherQuemAtende(["bia"], { id: "ana" })).toBeUndefined();
    expect(escolherQuemAtende([null], { id: null })).toBeNull();
    expect(escolherQuemAtende([], { qualquer: true })).toBeUndefined();
  });
});
