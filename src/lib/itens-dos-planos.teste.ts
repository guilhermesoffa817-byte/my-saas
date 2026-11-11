import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FAMILIAS } from "@/lib/assinatura";
import {
  ITENS_DO_NORMAL,
  ITENS_DO_PRO,
  ITENS_DO_VIP,
  ITENS_POR_PLANO,
  textosDoPlano,
} from "@/lib/itens-dos-planos";
import { LEITURAS_POR_MES, PERGUNTAS_POR_MES, RECURSOS, planoMinimo } from "@/lib/recursos";

// Os testes de plano partem de um servidor com a IA e o espaço de arquivos
// ligados. O bloco "só vende o que está ligado" desliga de propósito.
beforeEach(() => {
  vi.stubEnv("ANTHROPIC_API_KEY", "chave-de-teste");
  vi.stubEnv("SUPABASE_URL", "https://exemplo.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "chave-de-servico");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("o que cada plano promete", () => {
  it("cada linha está no plano que libera o recurso dela, nem antes nem depois", () => {
    for (const familia of FAMILIAS) {
      for (const item of ITENS_POR_PLANO[familia]) {
        for (const recurso of item.recursos) {
          expect(planoMinimo(recurso), `${item.texto} depende de ${recurso}`).toBe(familia);
        }
      }
    }
  });

  it("as linhas do Pro e do VIP sempre dependem de algum recurso", () => {
    for (const item of [...ITENS_DO_PRO, ...ITENS_DO_VIP]) {
      expect(item.recursos.length, item.texto).toBeGreaterThan(0);
    }
  });

  it("todo recurso aparece em alguma linha", () => {
    const anunciados = new Set(FAMILIAS.flatMap((f) => ITENS_POR_PLANO[f].flatMap((i) => i.recursos)));
    for (const recurso of RECURSOS) expect(anunciados.has(recurso), recurso).toBe(true);
  });

  it("o Normal é agenda e finanças, e não fala de função dos planos maiores", () => {
    const normal = textosDoPlano("normal").join(" ");
    expect(normal).toMatch(/Agenda/);
    expect(normal).toMatch(/Finanças/);
    expect(normal).not.toMatch(/lembrete|contas a pagar|contrato|recibo|custos|relat[óo]rio|contador|equipe|assistente/i);
    expect(ITENS_DO_NORMAL.flatMap((i) => i.recursos)).toEqual(expect.arrayContaining(["cobrar", "financas"]));
  });

  it("o Pro vende a leitura de contrato e recibo; o VIP, a cobrança no piloto", () => {
    expect(textosDoPlano("pro").join(" ")).toMatch(/contrato, do recibo/);
    expect(textosDoPlano("vip").join(" ")).toMatch(/Cobrança no piloto/);
  });

  it("não chama de automática uma cobrança que ainda é enviada pela dona", () => {
    const tudo = FAMILIAS.flatMap(textosDoPlano).join(" ");
    expect(tudo).not.toMatch(/autom[áa]tic/i);
  });

  it("usa as franquias de verdade, não um número escrito à mão", () => {
    expect(textosDoPlano("pro").join(" ")).toContain(`até ${LEITURAS_POR_MES} por mês`);
    expect(textosDoPlano("vip").join(" ")).toContain(`até ${PERGUNTAS_POR_MES} perguntas por mês`);
  });

  it("abre cada plano com o anterior e não repete linha", () => {
    expect(textosDoPlano("pro")[0]).toBe("Tudo do Normal");
    expect(textosDoPlano("vip")[0]).toBe("Tudo do Pro");
    const todos = FAMILIAS.flatMap(textosDoPlano);
    expect(new Set(todos).size).toBe(todos.length);
  });

  it("não promete o que o Bossa não faz", () => {
    const tudo = FAMILIAS.flatMap(textosDoPlano).join(" ");
    expect(tudo).not.toMatch(/garant|aumenta|folha de pagamento|eSocial|substitui/i);
  });
});

describe("só vende o que está ligado no servidor", () => {
  it("sem a chave da IA, a leitura some do Pro e o assistente some do VIP", () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const pro = textosDoPlano("pro").join(" | ");
    const vip = textosDoPlano("vip").join(" | ");
    expect(pro).not.toMatch(/lida pela IA/);
    expect(vip).not.toMatch(/Assistente/);
    // O resto continua sendo vendido.
    expect(pro).toMatch(/Custos fixos e variáveis/);
    expect(vip).toMatch(/Equipe/);
  });

  it("com a IA mas sem o espaço de arquivos, o assistente aparece e a leitura não", () => {
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    expect(textosDoPlano("vip").join(" | ")).toMatch(/Assistente/);
    expect(textosDoPlano("pro").join(" | ")).not.toMatch(/lida pela IA/);
  });
});
