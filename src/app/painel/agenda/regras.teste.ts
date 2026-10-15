import { describe, expect, it } from "vitest";
import { SITUACOES_DO_ATENDIMENTO } from "@/lib/atendimento";
import { chamadaDeHoje, podeMudarDeSituacao, seSobrepoem, valorAoRemarcar } from "./regras";

const as = (horario: string) => new Date(`2026-10-14T${horario}:00.000-03:00`);

describe("horários que se sobrepõem", () => {
  it("acusa quem começa no meio de outro atendimento", () => {
    expect(
      seSobrepoem({ inicio: as("09:00"), duracaoMin: 60 }, { inicio: as("09:30"), duracaoMin: 30 }),
    ).toBe(true);
  });

  it("acusa quem engloba outro atendimento inteiro", () => {
    expect(
      seSobrepoem({ inicio: as("09:00"), duracaoMin: 180 }, { inicio: as("10:00"), duracaoMin: 30 }),
    ).toBe(true);
  });

  it("encostar não é esbarrar", () => {
    expect(
      seSobrepoem({ inicio: as("09:00"), duracaoMin: 60 }, { inicio: as("10:00"), duracaoMin: 60 }),
    ).toBe(false);
    expect(
      seSobrepoem({ inicio: as("10:00"), duracaoMin: 60 }, { inicio: as("09:00"), duracaoMin: 60 }),
    ).toBe(false);
  });
});

describe("troca de situação", () => {
  it("só falta ou cancela quem está agendado", () => {
    expect(podeMudarDeSituacao("agendado", "faltou")).toBe(true);
    expect(podeMudarDeSituacao("agendado", "cancelado")).toBe(true);
    expect(podeMudarDeSituacao("concluido", "faltou")).toBe(false);
    expect(podeMudarDeSituacao("cancelado", "faltou")).toBe(false);
    expect(podeMudarDeSituacao("faltou", "cancelado")).toBe(false);
  });

  it("sempre deixa voltar para agendado", () => {
    for (const de of ["concluido", "faltou", "cancelado"]) {
      expect(podeMudarDeSituacao(de, "agendado")).toBe(true);
    }
  });

  it("deixa concluir quem chegou atrasado depois da falta", () => {
    expect(podeMudarDeSituacao("faltou", "concluido")).toBe(true);
  });

  it("não troca para a mesma situação", () => {
    for (const situacao of SITUACOES_DO_ATENDIMENTO) {
      expect(podeMudarDeSituacao(situacao, situacao)).toBe(false);
    }
  });
});

describe("valor ao remarcar", () => {
  const atual = { servicoId: "unha", valorCentavos: 8000 };

  it("mantém o combinado quando muda só o horário", () => {
    // O serviço subiu para R$ 95, mas o combinado era R$ 80.
    expect(valorAoRemarcar(atual, { id: "unha", precoCentavos: 9500 })).toBe(8000);
  });

  it("mantém o vazio dos horários antigos, que seguem no preço do serviço", () => {
    expect(
      valorAoRemarcar({ servicoId: "unha", valorCentavos: null }, { id: "unha", precoCentavos: 9500 }),
    ).toBeNull();
  });

  it("passa ao preço do serviço novo quando o serviço muda", () => {
    expect(valorAoRemarcar(atual, { id: "pe", precoCentavos: 6000 })).toBe(6000);
  });
});

describe("chamada de hoje", () => {
  const ana = { nome: "Ana", inicio: as("09:00") };
  const bia = { nome: "Bia", inicio: as("11:00") };
  const carla = { nome: "Carla", inicio: as("15:30") };

  it("não diz nada quando não há ninguém agendado", () => {
    expect(chamadaDeHoje([], as("08:00"))).toBeNull();
  });

  it("antes do primeiro, diz quem abre o dia", () => {
    expect(chamadaDeHoje([bia, ana, carla], as("08:00"))).toEqual({
      tipo: "primeiro",
      atendimento: ana,
    });
  });

  it("depois do primeiro, diz quem vem a seguir", () => {
    expect(chamadaDeHoje([ana, bia, carla], as("09:20"))).toEqual({
      tipo: "proximo",
      atendimento: bia,
    });
    expect(chamadaDeHoje([ana, bia, carla], as("12:00"))).toEqual({
      tipo: "proximo",
      atendimento: carla,
    });
  });

  it("quem começa agora já começou", () => {
    expect(chamadaDeHoje([ana, bia], as("11:00"))).toEqual({ tipo: "todos_comecaram" });
  });

  it("avisa quando todos já começaram ou terminaram", () => {
    expect(chamadaDeHoje([ana, bia, carla], as("18:00"))).toEqual({ tipo: "todos_comecaram" });
  });
});
