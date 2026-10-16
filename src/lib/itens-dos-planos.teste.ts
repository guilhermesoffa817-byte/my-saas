import { describe, expect, it } from "vitest";
import {
  ITENS_DO_ESSENCIAL,
  ITENS_DO_VIP,
  TUDO_DO_ESSENCIAL,
  textosDoPlano,
} from "@/lib/itens-dos-planos";
import {
  LEITURAS_POR_MES_NO_VIP,
  PERGUNTAS_POR_MES_NO_VIP,
  RECURSOS,
  soNoVip,
} from "@/lib/recursos";

describe("o que cada plano promete", () => {
  it("não promete no Essencial nada que só o VIP libera", () => {
    for (const item of ITENS_DO_ESSENCIAL) {
      for (const recurso of item.recursos) {
        expect(soNoVip(recurso), `${item.texto} depende de ${recurso}`).toBe(false);
      }
    }
  });

  it("lista no VIP só o que é do VIP", () => {
    for (const item of ITENS_DO_VIP) {
      expect(item.recursos.length, item.texto).toBeGreaterThan(0);
      for (const recurso of item.recursos) {
        expect(soNoVip(recurso), `${item.texto} depende de ${recurso}`).toBe(true);
      }
    }
  });

  it("mostra todo recurso do VIP em alguma linha do VIP", () => {
    const anunciados = new Set(ITENS_DO_VIP.flatMap((item) => item.recursos));
    for (const recurso of RECURSOS.filter(soNoVip)) {
      expect(anunciados.has(recurso), recurso).toBe(true);
    }
  });

  it("usa as franquias de verdade, não um número escrito à mão", () => {
    const vip = textosDoPlano("vip").join(" ");
    expect(vip).toContain(`até ${LEITURAS_POR_MES_NO_VIP} por mês`);
    expect(vip).toContain(`até ${PERGUNTAS_POR_MES_NO_VIP} perguntas por mês`);
  });

  it("abre a lista do VIP com o Essencial e não repete linha", () => {
    const vip = textosDoPlano("vip");
    expect(vip[0]).toBe(TUDO_DO_ESSENCIAL);
    const todos = [...textosDoPlano("essencial"), ...vip];
    expect(new Set(todos).size).toBe(todos.length);
  });

  it("não promete o que o Bossa não faz", () => {
    const tudo = [...textosDoPlano("essencial"), ...textosDoPlano("vip")].join(" ");
    expect(tudo).not.toMatch(/garant|aumenta|folha de pagamento|eSocial|substitui/i);
  });
});
