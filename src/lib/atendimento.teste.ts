import { describe, expect, it } from "vitest";
import {
  ROTULO_DA_SITUACAO,
  SITUACOES_DO_ATENDIMENTO,
  SITUACOES_QUE_OCUPAM,
  situacaoValida,
  valorDoAtendimento,
} from "./atendimento";

describe("valorDoAtendimento", () => {
  it("usa o valor combinado na hora de marcar", () => {
    expect(
      valorDoAtendimento({ valorCentavos: 12000, servico: { precoCentavos: 15000 } }),
    ).toBe(12000);
  });

  it("aceita atendimento combinado de graça", () => {
    expect(valorDoAtendimento({ valorCentavos: 0, servico: { precoCentavos: 15000 } })).toBe(0);
  });

  it("cai no preço do serviço quando o horário é anterior ao campo", () => {
    expect(
      valorDoAtendimento({ valorCentavos: null, servico: { precoCentavos: 15000 } }),
    ).toBe(15000);
  });
});

describe("situações do atendimento", () => {
  it("reconhece só as situações conhecidas", () => {
    expect(situacaoValida("faltou")).toBe(true);
    expect(situacaoValida("concluido")).toBe(true);
    expect(situacaoValida("apagado")).toBe(false);
    expect(situacaoValida(undefined)).toBe(false);
  });

  it("tem rótulo para cada situação", () => {
    for (const situacao of SITUACOES_DO_ATENDIMENTO) {
      expect(ROTULO_DA_SITUACAO[situacao]).toBeTruthy();
    }
  });

  it("falta e cancelamento liberam o horário", () => {
    expect(SITUACOES_QUE_OCUPAM).not.toContain("faltou");
    expect(SITUACOES_QUE_OCUPAM).not.toContain("cancelado");
  });
});
