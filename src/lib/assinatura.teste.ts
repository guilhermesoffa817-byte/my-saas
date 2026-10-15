import { describe, expect, it } from "vitest";
import {
  PLANOS,
  codigoDoPlano,
  pagandoEmDia,
  planoParaRenovar,
  planoPorCodigo,
  receitaRecorrente,
  temFinanceiro,
  valorMensalEquivalente,
  type CodigoPlano,
} from "./assinatura";

const AGORA = new Date("2026-10-14T15:00:00.000Z");
const futuro = new Date("2026-11-14T15:00:00.000Z");
const passado = new Date("2026-10-13T15:00:00.000Z");

const assinatura = (plano: string, status = "ativa", validaAte = futuro) => ({
  plano,
  status,
  validaAte,
});

describe("código do plano", () => {
  it("reconhece os quatro planos", () => {
    for (const codigo of Object.keys(PLANOS)) {
      expect(codigoDoPlano(codigo)).toBe(codigo);
    }
  });

  it("recusa o que não é plano, inclusive nomes herdados de objeto", () => {
    expect(codigoDoPlano("toString")).toBeNull();
    expect(codigoDoPlano("constructor")).toBeNull();
    expect(codigoDoPlano("__proto__")).toBeNull();
    expect(codigoDoPlano("VIP_MENSAL")).toBeNull();
    expect(codigoDoPlano("")).toBeNull();
    expect(codigoDoPlano(null)).toBeNull();
    expect(codigoDoPlano(42)).toBeNull();
  });

  it("um código estranho vira o mensal, nunca um plano sem preço", () => {
    expect(planoPorCodigo("toString")).toBe(PLANOS.mensal);
    expect(planoPorCodigo(undefined)).toBe(PLANOS.mensal);
    expect(planoPorCodigo("vip_anual")).toBe(PLANOS.vip_anual);
  });
});

describe("plano para renovar", () => {
  it("começa no plano que a pessoa já tem", () => {
    for (const codigo of Object.keys(PLANOS) as CodigoPlano[]) {
      expect(planoParaRenovar(assinatura(codigo))).toBe(codigo);
    }
  });

  it("vale também para quem venceu: renova o último plano pago", () => {
    expect(planoParaRenovar(assinatura("vip_mensal", "ativa", passado))).toBe("vip_mensal");
  });

  it("começa no mensal para quem está no teste, sem assinatura ou com plano estranho", () => {
    expect(planoParaRenovar(assinatura("vip_anual", "teste"))).toBe("mensal");
    expect(planoParaRenovar(null)).toBe("mensal");
    expect(planoParaRenovar(undefined)).toBe("mensal");
    expect(planoParaRenovar(assinatura("plano_antigo"))).toBe("mensal");
  });

  it("quem vem pela aba Finanças começa no VIP mensal, a não ser que já seja VIP", () => {
    expect(planoParaRenovar(assinatura("mensal"), true)).toBe("vip_mensal");
    expect(planoParaRenovar(assinatura("anual"), true)).toBe("vip_mensal");
    expect(planoParaRenovar(null, true)).toBe("vip_mensal");
    expect(planoParaRenovar(assinatura("mensal", "teste"), true)).toBe("vip_mensal");
    expect(planoParaRenovar(assinatura("vip_anual"), true)).toBe("vip_anual");
    expect(planoParaRenovar(assinatura("vip_mensal"), true)).toBe("vip_mensal");
  });
});

describe("identificador do Pix", () => {
  it("cada plano tem o seu, começando por BOSSA e dentro do limite do Pix", () => {
    const identificadores = Object.values(PLANOS).map((plano) => plano.identificadorPix);
    for (const identificador of identificadores) {
      expect(identificador).toMatch(/^BOSSA[A-Z0-9]*$/);
      expect(identificador.length).toBeLessThanOrEqual(25);
    }
    expect(new Set(identificadores).size).toBe(identificadores.length);
  });
});

describe("em dia", () => {
  it("só conta assinatura ativa e dentro do prazo", () => {
    expect(pagandoEmDia(assinatura("mensal"), AGORA)).toBe(true);
    expect(pagandoEmDia(assinatura("mensal", "teste"), AGORA)).toBe(false);
    expect(pagandoEmDia(assinatura("mensal", "aguardando"), AGORA)).toBe(false);
    expect(pagandoEmDia(assinatura("mensal", "ativa", passado), AGORA)).toBe(false);
    expect(pagandoEmDia(null, AGORA)).toBe(false);
  });

  it("a aba Finanças continua só para o VIP em dia", () => {
    expect(temFinanceiro(assinatura("vip_mensal"), AGORA)).toBe(true);
    expect(temFinanceiro(assinatura("vip_anual"), AGORA)).toBe(true);
    expect(temFinanceiro(assinatura("anual"), AGORA)).toBe(false);
    expect(temFinanceiro(assinatura("vip_mensal", "teste"), AGORA)).toBe(false);
    expect(temFinanceiro(assinatura("vip_mensal", "ativa", passado), AGORA)).toBe(false);
  });
});

describe("receita recorrente", () => {
  it("o mensal vale o preço dele; o anual entra dividido por doze", () => {
    expect(valorMensalEquivalente(PLANOS.mensal)).toBe(PLANOS.mensal.valorCentavos);
    expect(valorMensalEquivalente(PLANOS.vip_mensal)).toBe(PLANOS.vip_mensal.valorCentavos);
    expect(valorMensalEquivalente(PLANOS.anual)).toBe(
      Math.round(PLANOS.anual.valorCentavos / 12),
    );
    expect(valorMensalEquivalente(PLANOS.vip_anual)).toBe(
      Math.round(PLANOS.vip_anual.valorCentavos / 12),
    );
  });

  it("soma cada assinatura em dia pelo valor mensal do plano dela", () => {
    const total = receitaRecorrente(
      [
        assinatura("mensal"),
        assinatura("vip_mensal"),
        assinatura("anual"),
        assinatura("vip_anual"),
      ],
      AGORA,
    );
    expect(total).toBe(
      Math.round(
        PLANOS.mensal.valorCentavos +
          PLANOS.vip_mensal.valorCentavos +
          PLANOS.anual.valorCentavos / 12 +
          PLANOS.vip_anual.valorCentavos / 12,
      ),
    );
  });

  it("não conta teste, Pix em conferência, assinatura vencida nem conta sem assinatura", () => {
    expect(
      receitaRecorrente(
        [
          assinatura("vip_mensal", "teste"),
          assinatura("vip_mensal", "aguardando"),
          assinatura("vip_mensal", "ativa", passado),
          null,
          undefined,
        ],
        AGORA,
      ),
    ).toBe(0);
  });

  it("arredonda só no fim, para que vários anuais não percam centavos", () => {
    const anuais = Array.from({ length: 12 }, () => assinatura("anual"));
    expect(receitaRecorrente(anuais, AGORA)).toBe(PLANOS.anual.valorCentavos);
  });

  it("não usa o preço do mensal para todo mundo, que era o erro antigo", () => {
    const vip = receitaRecorrente([assinatura("vip_mensal")], AGORA);
    expect(vip).toBe(PLANOS.vip_mensal.valorCentavos);
    expect(vip).not.toBe(PLANOS.mensal.valorCentavos);
  });
});
