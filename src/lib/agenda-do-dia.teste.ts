import { describe, expect, it } from "vitest";
import { chamadaDeHoje, type HorarioDeHoje } from "./agenda-do-dia";

const sp = (texto: string) => new Date(`2026-10-18T${texto}:00-03:00`);

function horario(inicio: string, nome: string, status = "agendado", duracaoMin = 60): HorarioDeHoje {
  return { inicio: sp(inicio), status, cliente: { nome }, servico: { duracaoMin } };
}

describe("chamada de hoje no Início", () => {
  it("fala do próximo agendado, não do primeiro da lista já concluído", () => {
    const lista = [
      horario("09:00", "Renata Carvalho", "concluido"),
      horario("17:30", "Luciana Ferreira"),
    ];
    expect(chamadaDeHoje(lista, sp("11:00"))).toEqual({
      titulo: "Falta 1 atendimento hoje",
      detalhe: "O próximo é às 17:30, de Luciana Ferreira.",
    });
  });

  it("sem nada agendado (só concluído e cancelado), não chama", () => {
    const lista = [horario("09:00", "Renata Carvalho", "concluido"), horario("10:00", "Ana", "cancelado")];
    expect(chamadaDeHoje(lista, sp("08:00"))).toBeNull();
  });

  it("no meio do atendimento, diz que está acontecendo agora", () => {
    expect(chamadaDeHoje([horario("09:00", "Renata Carvalho")], sp("09:20"))).toEqual({
      titulo: "Falta 1 atendimento hoje",
      detalhe: "Em atendimento agora: Renata Carvalho, até as 10:00.",
    });
  });

  it("lembra do que já passou sem ser concluído", () => {
    const lista = [horario("09:00", "Renata Carvalho"), horario("17:30", "Luciana Ferreira")];
    expect(chamadaDeHoje(lista, sp("12:00"))).toEqual({
      titulo: "Falta 1 atendimento hoje",
      detalhe: "O próximo é às 17:30, de Luciana Ferreira. 1 que já passou ainda não foi marcado como concluído.",
    });
  });

  it("no fim do dia, pede para concluir os que ficaram", () => {
    const lista = [horario("09:00", "Renata Carvalho"), horario("14:00", "Luciana Ferreira")];
    expect(chamadaDeHoje(lista, sp("20:00"))).toEqual({
      titulo: "2 atendimentos de hoje para concluir",
      detalhe: "Renata Carvalho, às 09:00 e mais 1. Marque como concluído na agenda.",
    });
  });

  it("conta no plural", () => {
    const lista = [horario("10:00", "A"), horario("11:00", "B"), horario("15:00", "C")];
    expect(chamadaDeHoje(lista, sp("08:00"))?.titulo).toBe("Faltam 3 atendimentos hoje");
  });
});
