import { describe, expect, it } from "vitest";
import {
  avisoDoVencimento,
  ocorrenciasMensais,
  ocorrenciasQueFaltam,
  situacaoDoVencimento,
} from "@/lib/vencimento";
import { deDataPura, paraDataPura } from "@/lib/formato";

const dia = (texto: string) => deDataPura(texto)!;
const dias = (datas: Date[]) => datas.map(paraDataPura);
const HOJE = dia("2026-10-05");

describe("situação do vencimento", () => {
  it("separa a pagar, vence hoje, atrasado e pago", () => {
    expect(situacaoDoVencimento({ pago: false, data: dia("2026-10-10") }, HOJE)).toBe("a_pagar");
    expect(situacaoDoVencimento({ pago: false, data: HOJE }, HOJE)).toBe("vence_hoje");
    expect(situacaoDoVencimento({ pago: false, data: dia("2026-10-04") }, HOJE)).toBe("atrasado");
    expect(situacaoDoVencimento({ pago: true, data: dia("2020-01-01") }, HOJE)).toBe("pago");
  });
});

describe("aviso do vencimento", () => {
  it("só avisa de conta na semana que antecede", () => {
    const conta = { pago: false, tipo: "conta" as const };
    expect(avisoDoVencimento({ ...conta, data: dia("2026-11-30") }, HOJE)).toBeNull();
    expect(avisoDoVencimento({ ...conta, data: dia("2026-10-12") }, HOJE)).toBe("Vence em 7 dias");
    expect(avisoDoVencimento({ ...conta, data: dia("2026-10-06") }, HOJE)).toBe("Vence amanhã");
    expect(avisoDoVencimento({ ...conta, data: HOJE }, HOJE)).toBe("Vence hoje");
    expect(avisoDoVencimento({ ...conta, data: dia("2026-10-04") }, HOJE)).toBe("Venceu ontem");
    expect(avisoDoVencimento({ ...conta, data: dia("2026-09-25") }, HOJE)).toBe("Venceu há 10 dias");
  });

  it("avisa de prazo de contrato com trinta dias", () => {
    const prazo = { pago: false, tipo: "prazo" as const };
    expect(avisoDoVencimento({ ...prazo, data: dia("2026-11-04") }, HOJE)).toBe("Vence em 30 dias");
    expect(avisoDoVencimento({ ...prazo, data: dia("2026-11-05") }, HOJE)).toBeNull();
  });

  it("não avisa do que já foi pago", () => {
    expect(avisoDoVencimento({ pago: true, tipo: "conta", data: dia("2020-01-01") }, HOJE)).toBeNull();
  });
});

describe("repetição mensal", () => {
  it("mantém o mesmo dia mês a mês", () => {
    const datas = ocorrenciasMensais({ primeira: dia("2026-10-10"), quantasNoMaximo: 4 });
    expect(dias(datas)).toEqual(["2026-10-10", "2026-11-10", "2026-12-10", "2027-01-10"]);
  });

  it("dia 31 cai no último dia dos meses mais curtos, e volta ao 31 depois", () => {
    const datas = ocorrenciasMensais({ primeira: dia("2026-01-31"), quantasNoMaximo: 5 });
    expect(dias(datas)).toEqual([
      "2026-01-31",
      "2026-02-28", // fevereiro não tem 31, nem 30, nem 29
      "2026-03-31", // e março volta ao 31: o dia 31 é a referência, não o que sobrou
      "2026-04-30",
      "2026-05-31",
    ]);
  });

  it("dia 30 e dia 29 também respeitam fevereiro", () => {
    expect(dias(ocorrenciasMensais({ primeira: dia("2026-01-30"), quantasNoMaximo: 2 }))).toEqual([
      "2026-01-30",
      "2026-02-28",
    ]);
    expect(dias(ocorrenciasMensais({ primeira: dia("2026-01-29"), quantasNoMaximo: 2 }))).toEqual([
      "2026-01-29",
      "2026-02-28",
    ]);
  });

  it("em ano bissexto, fevereiro tem 29", () => {
    expect(dias(ocorrenciasMensais({ primeira: dia("2028-01-31"), quantasNoMaximo: 2 }))).toEqual([
      "2028-01-31",
      "2028-02-29",
    ]);
  });

  it("vira o ano sem tropeçar", () => {
    expect(dias(ocorrenciasMensais({ primeira: dia("2026-11-15"), quantasNoMaximo: 4 }))).toEqual([
      "2026-11-15",
      "2026-12-15",
      "2027-01-15",
      "2027-02-15",
    ]);
  });

  it("para na data final do combinado", () => {
    const datas = ocorrenciasMensais({
      primeira: dia("2026-10-10"),
      ate: dia("2026-12-31"),
      quantasNoMaximo: 12,
    });
    expect(dias(datas)).toEqual(["2026-10-10", "2026-11-10", "2026-12-10"]);
  });

  it("inclui a ocorrência que cai exatamente na data final", () => {
    const datas = ocorrenciasMensais({
      primeira: dia("2026-10-10"),
      ate: dia("2026-12-10"),
      quantasNoMaximo: 12,
    });
    expect(dias(datas).at(-1)).toBe("2026-12-10");
  });

  it("sem data final, mantém doze meses adiantados", () => {
    expect(ocorrenciasMensais({ primeira: dia("2026-10-10") })).toHaveLength(12);
  });
});

describe("o que falta gravar", () => {
  it("devolve só o que ainda não existe", () => {
    const faltam = ocorrenciasQueFaltam({
      primeira: dia("2026-10-10"),
      jaGravadas: [dia("2026-10-10"), dia("2026-11-10")],
      hoje: HOJE,
    });
    expect(dias(faltam)).not.toContain("2026-10-10");
    expect(dias(faltam)).not.toContain("2026-11-10");
    expect(dias(faltam)).toContain("2026-12-10");
  });

  it("uma conta antiga continua gerando os próximos meses, não os passados", () => {
    // Criada há dois anos, sem data final: a janela acompanha o tempo.
    const faltam = ocorrenciasQueFaltam({
      primeira: dia("2024-03-20"),
      jaGravadas: [],
      hoje: HOJE,
    });
    expect(dias(faltam)[0]).toBe("2026-10-20");
    expect(faltam).toHaveLength(12);
    // Nenhuma data do passado entra.
    for (const data of faltam) {
      expect(paraDataPura(data) >= "2026-10-05").toBe(true);
    }
  });

  it("não gera nada depois da data final", () => {
    const faltam = ocorrenciasQueFaltam({
      primeira: dia("2026-10-10"),
      ate: dia("2026-11-30"),
      jaGravadas: [],
      hoje: HOJE,
    });
    expect(dias(faltam)).toEqual(["2026-10-10", "2026-11-10"]);
  });

  it("combinado já encerrado não gera mais nada", () => {
    const faltam = ocorrenciasQueFaltam({
      primeira: dia("2025-01-10"),
      ate: dia("2025-12-10"),
      jaGravadas: [],
      hoje: HOJE,
    });
    expect(faltam).toEqual([]);
  });
});
