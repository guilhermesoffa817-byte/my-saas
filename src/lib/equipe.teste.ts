import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  AUSENCIAS_POR_VINCULO,
  PAGAMENTOS_POR_VINCULO,
  ROTULO_DA_AUSENCIA,
  ROTULO_DO_PAGAMENTO,
  SOBRE_O_VINCULO,
  TERMOS_POR_VINCULO,
  TIPOS_DE_AUSENCIA,
  TIPOS_DE_PAGAMENTO,
  VINCULOS,
  alertasDaEquipe,
  aplicarPercentual,
  ativoNoMes,
  ausenciaPermitida,
  ausenteNoDia,
  categoriaDoPagamento,
  centavosParaCampo,
  combinadoDoVinculo,
  descricaoDoLancamento,
  diasNoPeriodo,
  estaAtivo,
  formatarPercentual,
  limitesDoMes,
  nomeCurto,
  pagamentoPermitido,
  pontosBaseParaTexto,
  resumirCombinado,
  somarMeses,
  somarMesesACompetencia,
  sugestaoDoColaborador,
  textoParaPontosBase,
  tipoDePagamentoSugerido,
  trocaDeVinculoRecusada,
  trocaParaVinculoSemEmprego,
  valorDoTipoDePagamento,
  valorSugeridoDoMes,
  type ColaboradorParaAlerta,
} from "./equipe";
import { ESTAGIO_DURACAO_MAX_MESES, MEI_MAX_EMPREGADOS } from "./leis";

const semEspacoDuro = (texto: string) => texto.replace(/ /g, " ");

describe("as listas da tela são as mesmas que o banco aceita", () => {
  /*
    A migração da Equipe tem CHECK com os vínculos e os tipos. Se alguém
    acrescentar um tipo aqui e esquecer o banco, a gravação quebra em produção.
    Este teste lê o SQL e compara.
  */
  const pasta = join(process.cwd(), "prisma", "migrations");
  const sql = readdirSync(pasta)
    .filter((nome) => /^\d+_/.test(nome))
    .map((nome) => {
      try {
        return readFileSync(join(pasta, nome, "migration.sql"), "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");

  function listaDoCheck(nome: string) {
    const achado = new RegExp(`"${nome}"\\s+CHECK\\s*\\(\\s*"\\w+"\\s+IN\\s*\\(([^)]*)\\)`, "i").exec(sql);
    if (!achado) throw new Error(`CHECK ${nome} não encontrado nas migrações.`);
    return [...achado[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  }

  it("vínculos", () => {
    expect([...VINCULOS].sort()).toEqual(listaDoCheck("Colaborador_vinculo_check"));
  });

  it("tipos de ausência", () => {
    expect([...TIPOS_DE_AUSENCIA].sort()).toEqual(listaDoCheck("AusenciaDoColaborador_tipo_check"));
  });

  it("tipos de pagamento", () => {
    expect([...TIPOS_DE_PAGAMENTO].sort()).toEqual(listaDoCheck("PagamentoDeColaborador_tipo_check"));
  });

  it("todo tipo tem rótulo e todo vínculo tem descrição", () => {
    for (const tipo of TIPOS_DE_AUSENCIA) expect(ROTULO_DA_AUSENCIA[tipo]).toBeTruthy();
    for (const tipo of TIPOS_DE_PAGAMENTO) expect(ROTULO_DO_PAGAMENTO[tipo]).toBeTruthy();
    for (const vinculo of VINCULOS) {
      expect(SOBRE_O_VINCULO[vinculo].rotulo).toBeTruthy();
      expect(SOBRE_O_VINCULO[vinculo].descricao).toBeTruthy();
      expect(AUSENCIAS_POR_VINCULO[vinculo].length).toBeGreaterThan(0);
      expect(PAGAMENTOS_POR_VINCULO[vinculo].length).toBeGreaterThan(0);
    }
  });
});

describe("as palavras certas para cada vínculo", () => {
  it("estágio tem recesso, nunca férias", () => {
    expect(ausenciaPermitida("estagio", "recesso")).toBe(true);
    expect(ausenciaPermitida("estagio", "ferias")).toBe(false);
  });

  it("quem não é empregada só fica indisponível na agenda", () => {
    for (const vinculo of ["parceria", "mei", "pj", "autonomo"] as const) {
      expect(AUSENCIAS_POR_VINCULO[vinculo]).toEqual(["indisponivel"]);
      expect(ausenciaPermitida(vinculo, "falta")).toBe(false);
      expect(ausenciaPermitida(vinculo, "ferias")).toBe(false);
      expect(ausenciaPermitida(vinculo, "folga")).toBe(false);
    }
    expect(ROTULO_DA_AUSENCIA.indisponivel).toBe("Indisponível na agenda");
  });

  it("parceria recebe cota-parte, nunca salário nem comissão", () => {
    expect(pagamentoPermitido("parceria", "cota_parte")).toBe(true);
    expect(pagamentoPermitido("parceria", "salario")).toBe(false);
    expect(pagamentoPermitido("parceria", "comissao")).toBe(false);
    expect(TERMOS_POR_VINCULO.parceria.percentual?.rotulo).toMatch(/cota-parte/i);
    expect(TERMOS_POR_VINCULO.parceria.fixo).toBeNull();
  });

  it("MEI, PJ e autônoma recebem repasse, sem salário", () => {
    for (const vinculo of ["mei", "pj", "autonomo"] as const) {
      expect(pagamentoPermitido(vinculo, "repasse")).toBe(true);
      expect(pagamentoPermitido(vinculo, "salario")).toBe(false);
      expect(pagamentoPermitido(vinculo, "rescisao")).toBe(false);
      expect(TERMOS_POR_VINCULO[vinculo].fixo).toBeNull();
      expect(TERMOS_POR_VINCULO[vinculo].percentual?.rotulo).toBe("Percentual combinado");
      expect(TERMOS_POR_VINCULO[vinculo].porAtendimento?.rotulo).toBe("Valor por atendimento");
    }
  });

  it("CLT fala em salário e comissão; estágio em bolsa-auxílio", () => {
    expect(TERMOS_POR_VINCULO.clt.fixo?.rotulo).toBe("Salário");
    expect(TERMOS_POR_VINCULO.clt.percentual?.rotulo).toBe("Comissão");
    expect(TERMOS_POR_VINCULO.estagio.fixo?.rotulo).toBe("Bolsa-auxílio");
    expect(TERMOS_POR_VINCULO.estagio.percentual).toBeNull();
    expect(pagamentoPermitido("estagio", "salario")).toBe(false);
  });

  it("nenhum texto promete folha, holerite, eSocial ou ponto", () => {
    const textos = JSON.stringify([SOBRE_O_VINCULO, TERMOS_POR_VINCULO, ROTULO_DA_AUSENCIA, ROTULO_DO_PAGAMENTO]);
    expect(textos).not.toMatch(/folha de pagamento|holerite|e-?social|\bponto\b/i);
  });

  it("o tipo sugerido é sempre um tipo permitido", () => {
    const zerado = { salarioCentavos: 0, comissaoPontosBase: 0, porAtendimentoCentavos: 0 };
    for (const vinculo of VINCULOS) {
      expect(pagamentoPermitido(vinculo, tipoDePagamentoSugerido(vinculo, zerado))).toBe(true);
    }
    expect(tipoDePagamentoSugerido("clt", { ...zerado, comissaoPontosBase: 1000 })).toBe("comissao");
    expect(
      tipoDePagamentoSugerido("clt", { ...zerado, salarioCentavos: 190000, comissaoPontosBase: 1000 }),
    ).toBe("salario");
    expect(tipoDePagamentoSugerido("parceria", zerado)).toBe("cota_parte");
    expect(tipoDePagamentoSugerido("mei", zerado)).toBe("repasse");
    expect(tipoDePagamentoSugerido("estagio", zerado)).toBe("bolsa");
  });

  it("categoria nas Finanças", () => {
    expect(categoriaDoPagamento("salario")).toBe("Salários e encargos");
    expect(categoriaDoPagamento("encargo")).toBe("Salários e encargos");
    expect(categoriaDoPagamento("bolsa")).toBe("Salários e encargos");
    expect(categoriaDoPagamento("comissao")).toBe("Comissões e repasses");
    expect(categoriaDoPagamento("cota_parte")).toBe("Comissões e repasses");
    expect(categoriaDoPagamento("repasse")).toBe("Comissões e repasses");
  });
});

describe("troca de vínculo", () => {
  const vazio = { ausencias: [], pagamentos: [] };

  it("de CLT ou estágio para quem não é empregada é a troca delicada", () => {
    expect(trocaParaVinculoSemEmprego("clt", "pj")).toBe(true);
    expect(trocaParaVinculoSemEmprego("estagio", "parceria")).toBe(true);
    expect(trocaParaVinculoSemEmprego("estagio", "clt")).toBe(false);
    expect(trocaParaVinculoSemEmprego("mei", "clt")).toBe(false);
    expect(trocaParaVinculoSemEmprego("clt", "clt")).toBe(false);
  });

  it("recusa virar PJ com férias ou salário no histórico", () => {
    expect(trocaDeVinculoRecusada("clt", "pj", { ausencias: ["ferias"], pagamentos: [] })).toBe(true);
    expect(trocaDeVinculoRecusada("clt", "mei", { ausencias: [], pagamentos: ["salario"] })).toBe(true);
    expect(trocaDeVinculoRecusada("estagio", "parceria", { ausencias: ["recesso"], pagamentos: [] })).toBe(
      true,
    );
  });

  it("deixa corrigir um cadastro sem histórico de emprego", () => {
    expect(trocaDeVinculoRecusada("clt", "pj", vazio)).toBe(false);
    expect(trocaDeVinculoRecusada("clt", "pj", { ausencias: ["indisponivel"], pagamentos: ["outro"] })).toBe(
      false,
    );
  });

  it("efetivar a estagiária e trocar entre prestadoras é livre", () => {
    const historico = { ausencias: ["ferias", "falta"], pagamentos: ["bolsa"] };
    expect(trocaDeVinculoRecusada("estagio", "clt", historico)).toBe(false);
    expect(trocaDeVinculoRecusada("mei", "pj", { ausencias: [], pagamentos: ["repasse"] })).toBe(false);
  });
});

describe("o combinado", () => {
  it("zera o que não existe no vínculo", () => {
    const valores = { salarioCentavos: 190000, comissaoPontosBase: 1000, porAtendimentoCentavos: 2500 };
    expect(combinadoDoVinculo("clt", valores)).toEqual({
      salarioCentavos: 190000,
      comissaoPontosBase: 1000,
      porAtendimentoCentavos: 0,
    });
    expect(combinadoDoVinculo("parceria", valores)).toEqual({
      salarioCentavos: 0,
      comissaoPontosBase: 1000,
      porAtendimentoCentavos: 0,
    });
    expect(combinadoDoVinculo("mei", valores)).toEqual({
      salarioCentavos: 0,
      comissaoPontosBase: 1000,
      porAtendimentoCentavos: 2500,
    });
    expect(combinadoDoVinculo("estagio", valores)).toEqual({
      salarioCentavos: 190000,
      comissaoPontosBase: 0,
      porAtendimentoCentavos: 0,
    });
  });

  it("resume em uma linha", () => {
    expect(
      semEspacoDuro(resumirCombinado("clt", { salarioCentavos: 190000, comissaoPontosBase: 1000, porAtendimentoCentavos: 0 })),
    ).toBe("Salário R$ 1.900,00 + comissão 10%");
    expect(
      semEspacoDuro(resumirCombinado("parceria", { salarioCentavos: 0, comissaoPontosBase: 6000, porAtendimentoCentavos: 0 })),
    ).toBe("Cota-parte da profissional 60%");
    expect(
      semEspacoDuro(resumirCombinado("mei", { salarioCentavos: 0, comissaoPontosBase: 0, porAtendimentoCentavos: 2500 })),
    ).toBe("R$ 25,00 por atendimento");
    expect(
      semEspacoDuro(resumirCombinado("pj", { salarioCentavos: 0, comissaoPontosBase: 3050, porAtendimentoCentavos: 1000 })),
    ).toBe("Percentual combinado 30,5% + R$ 10,00 por atendimento");
    expect(resumirCombinado("clt", { salarioCentavos: 0, comissaoPontosBase: 0, porAtendimentoCentavos: 0 })).toBe(
      "Nada combinado ainda",
    );
  });
});

describe("percentual em pontos-base, sem número quebrado", () => {
  it("aplica o percentual arredondando ao centavo", () => {
    expect(aplicarPercentual(10000, 4000)).toBe(4000);
    expect(aplicarPercentual(12345, 4050)).toBe(5000);
    expect(aplicarPercentual(333, 3333)).toBe(111);
    expect(aplicarPercentual(0, 6000)).toBe(0);
    expect(aplicarPercentual(19990, 10000)).toBe(19990);
    expect(Number.isInteger(aplicarPercentual(99999, 1234))).toBe(true);
  });

  it("lê o que a pessoa digita", () => {
    expect(textoParaPontosBase("40")).toBe(4000);
    expect(textoParaPontosBase("40,5")).toBe(4050);
    expect(textoParaPontosBase("40.5")).toBe(4050);
    expect(textoParaPontosBase("12,25%")).toBe(1225);
    expect(textoParaPontosBase(" 12,25 % ")).toBe(1225);
    expect(textoParaPontosBase("0,05")).toBe(5);
    expect(textoParaPontosBase("100")).toBe(10000);
    expect(textoParaPontosBase("40,")).toBe(4000);
    expect(textoParaPontosBase("")).toBe(0);
    // Onde a conta com número quebrado erraria: 0,29 × 100 = 28,999...
    expect(textoParaPontosBase("0,29")).toBe(29);
    expect(textoParaPontosBase("4,35")).toBe(435);
  });

  it("recusa o que não é percentual válido", () => {
    expect(textoParaPontosBase("100,01")).toBeNull();
    expect(textoParaPontosBase("150")).toBeNull();
    expect(textoParaPontosBase("12,345")).toBeNull();
    expect(textoParaPontosBase("-5")).toBeNull();
    expect(textoParaPontosBase("abc")).toBeNull();
    expect(textoParaPontosBase("1.000")).toBeNull();
    expect(textoParaPontosBase(",5")).toBeNull();
  });

  it("escreve de volta para a tela, e a ida e volta não perde nada", () => {
    expect(pontosBaseParaTexto(4000)).toBe("40");
    expect(pontosBaseParaTexto(4050)).toBe("40,5");
    expect(pontosBaseParaTexto(1225)).toBe("12,25");
    expect(pontosBaseParaTexto(5)).toBe("0,05");
    expect(formatarPercentual(6000)).toBe("60%");
    for (let pontos = 0; pontos <= 10000; pontos += 7) {
      expect(textoParaPontosBase(pontosBaseParaTexto(pontos))).toBe(pontos);
    }
  });

  it("devolve centavos ao campo sem número quebrado", () => {
    expect(centavosParaCampo(190050)).toBe("1900,50");
    expect(centavosParaCampo(5)).toBe("0,05");
    expect(centavosParaCampo(0)).toBe("");
  });
});

describe("valor sugerido do mês", () => {
  it("fixo + percentual × base + por atendimento × quantidade", () => {
    expect(
      valorSugeridoDoMes({
        salarioCentavos: 190000,
        comissaoPontosBase: 1000,
        porAtendimentoCentavos: 0,
        baseCentavos: 845000,
        atendimentos: 0,
      }),
    ).toEqual({ fixoCentavos: 190000, percentualCentavos: 84500, porAtendimentoCentavos: 0, totalCentavos: 274500 });

    expect(
      valorSugeridoDoMes({
        salarioCentavos: 0,
        comissaoPontosBase: 0,
        porAtendimentoCentavos: 2500,
        baseCentavos: 0,
        atendimentos: 37,
      }).totalCentavos,
    ).toBe(92500);

    expect(
      valorSugeridoDoMes({
        salarioCentavos: 0,
        comissaoPontosBase: 6000,
        porAtendimentoCentavos: 0,
        baseCentavos: 1234567,
        atendimentos: 80,
      }).totalCentavos,
    ).toBe(740740);
  });

  it("limpa o combinado pelo vínculo antes da conta", () => {
    // Uma parceira com salário gravado por engano não recebe salário na sugestão.
    const parceira = {
      vinculo: "parceria" as const,
      salarioCentavos: 150000,
      comissaoPontosBase: 6000,
      porAtendimentoCentavos: 0,
    };
    expect(sugestaoDoColaborador(parceira, { baseCentavos: 100000, atendimentos: 8 }).totalCentavos).toBe(60000);
    expect(sugestaoDoColaborador(parceira, undefined).totalCentavos).toBe(0);
  });

  it("cada tipo puxa a parte certa; o resto vem vazio", () => {
    const sugerido = valorSugeridoDoMes({
      salarioCentavos: 190000,
      comissaoPontosBase: 1000,
      porAtendimentoCentavos: 2500,
      baseCentavos: 845000,
      atendimentos: 4,
    });
    expect(valorDoTipoDePagamento("salario", sugerido)).toBe(190000);
    expect(valorDoTipoDePagamento("bolsa", sugerido)).toBe(190000);
    expect(valorDoTipoDePagamento("comissao", sugerido)).toBe(84500);
    expect(valorDoTipoDePagamento("cota_parte", sugerido)).toBe(94500);
    expect(valorDoTipoDePagamento("repasse", sugerido)).toBe(94500);
    for (const tipo of ["adiantamento", "bonus", "beneficio", "encargo", "rescisao", "outro"] as const) {
      expect(valorDoTipoDePagamento(tipo, sugerido)).toBe(0);
    }
  });
});

describe("descrição do lançamento", () => {
  it("leva o tipo e o nome abreviado, nunca o nome inteiro", () => {
    expect(nomeCurto("Juliana Prado")).toBe("Juliana P.");
    expect(nomeCurto("  Ana   Clara de  souza ")).toBe("Ana S.");
    expect(nomeCurto("Bia")).toBe("Bia");
    expect(descricaoDoLancamento("cota_parte", "Juliana Prado")).toBe("Cota-parte — Juliana P.");
    expect(descricaoDoLancamento("salario", "Rafael Lima")).toBe("Salário — Rafael L.");
    expect(descricaoDoLancamento("repasse", null)).toBe("Repasse — Ex-colaborador");
  });
});

describe("datas de calendário", () => {
  it("conta os dias do período, inclusive o primeiro e o último", () => {
    expect(diasNoPeriodo("2026-11-03", "2026-11-03")).toBe(1);
    expect(diasNoPeriodo("2026-11-03", "2026-11-17")).toBe(15);
    expect(diasNoPeriodo("2026-02-27", "2026-03-02")).toBe(4);
  });

  it("soma meses encostando no fim do mês", () => {
    expect(somarMeses("2024-01-31", 1)).toBe("2024-02-29");
    expect(somarMeses("2025-01-31", 1)).toBe("2025-02-28");
    expect(somarMeses("2024-10-15", 24)).toBe("2026-10-15");
    expect(somarMesesACompetencia("2026-12", 1)).toBe("2027-01");
    expect(somarMesesACompetencia("2026-01", -1)).toBe("2025-12");
  });

  it("limites do mês", () => {
    expect(limitesDoMes("2026-02")).toEqual({ de: "2026-02-01", ate: "2026-02-28" });
    expect(limitesDoMes("2024-02")).toEqual({ de: "2024-02-01", ate: "2024-02-29" });
  });

  it("ativo hoje, ativo no mês e ausente no dia", () => {
    expect(estaAtivo({ inicio: "2026-01-05", fim: null }, "2026-10-12")).toBe(true);
    expect(estaAtivo({ inicio: "2026-01-05", fim: "2026-10-12" }, "2026-10-12")).toBe(true);
    expect(estaAtivo({ inicio: "2026-01-05", fim: "2026-10-11" }, "2026-10-12")).toBe(false);
    expect(estaAtivo({ inicio: "2026-11-01", fim: null }, "2026-10-12")).toBe(false);

    expect(ativoNoMes({ inicio: "2026-10-31", fim: null }, "2026-10")).toBe(true);
    expect(ativoNoMes({ inicio: "2026-01-05", fim: "2026-10-01" }, "2026-10")).toBe(true);
    expect(ativoNoMes({ inicio: "2026-01-05", fim: "2026-09-30" }, "2026-10")).toBe(false);

    expect(ausenteNoDia({ inicio: "2026-10-10", fim: "2026-10-12" }, "2026-10-12")).toBe(true);
    expect(ausenteNoDia({ inicio: "2026-10-10", fim: "2026-10-12" }, "2026-10-13")).toBe(false);
  });
});

describe("avisos", () => {
  const hoje = "2026-10-12";
  const pessoa = (dados: Partial<ColaboradorParaAlerta>): ColaboradorParaAlerta => ({
    id: dados.id ?? "1",
    nome: dados.nome ?? "Rafael Lima",
    vinculo: dados.vinculo ?? "clt",
    inicio: dados.inicio ?? "2026-01-05",
    fim: dados.fim ?? null,
    removido: dados.removido,
  });
  const duas = [pessoa({ id: "1" }), pessoa({ id: "2", nome: "Carla Mendes" })].slice(0, MEI_MAX_EMPREGADOS + 1);

  it("MEI com mais empregadas CLT do que o permitido", () => {
    const alertas = alertasDaEquipe({ ehMei: true, hoje, colaboradores: duas });
    expect(alertas[0]).toMatchObject({ chave: "mei-empregados", nivel: "atencao" });
    expect(alertas[0].texto).toContain("art. 18-C");

    expect(alertasDaEquipe({ ehMei: true, hoje, colaboradores: duas.slice(0, MEI_MAX_EMPREGADOS) })).toEqual([]);
    expect(alertasDaEquipe({ ehMei: false, hoje, colaboradores: duas })).toEqual([]);
    expect(
      alertasDaEquipe({ ehMei: true, hoje, colaboradores: [pessoa({ id: "1" }), pessoa({ id: "2", fim: "2026-09-30" })] }),
    ).toEqual([]);
    expect(
      alertasDaEquipe({ ehMei: true, hoje, colaboradores: [pessoa({ id: "1" }), pessoa({ id: "2", vinculo: "mei" })] }),
    ).toEqual([]);
  });

  it("sem saber o regime, o aviso do MEI é só lembrete, e condicional", () => {
    const alertas = alertasDaEquipe({ ehMei: null, hoje, colaboradores: duas });
    expect(alertas[0]).toMatchObject({ chave: "mei-empregados", nivel: "lembrete" });
    expect(alertas[0].titulo).toMatch(/^Se /);
  });

  it("estágio além do prazo máximo", () => {
    const noLimite = pessoa({ vinculo: "estagio", nome: "Lívia Souza", inicio: somarMeses(hoje, -ESTAGIO_DURACAO_MAX_MESES) });
    expect(alertasDaEquipe({ ehMei: false, hoje, colaboradores: [noLimite] })).toEqual([]);

    const passou = { ...noLimite, inicio: somarMeses(noLimite.inicio, -1) };
    const alertas = alertasDaEquipe({ ehMei: false, hoje, colaboradores: [passou] });
    expect(alertas).toHaveLength(1);
    expect(alertas[0].titulo).toContain("Lívia Souza");
    expect(alertas[0].texto).toContain("Lei 11.788/2008");

    expect(alertasDaEquipe({ ehMei: false, hoje, colaboradores: [{ ...passou, fim: "2026-09-01" }] })).toEqual([]);
  });

  it("parceria lembra do contrato homologado e da receita bruta", () => {
    const alertas = alertasDaEquipe({
      ehMei: false,
      hoje,
      colaboradores: [pessoa({ vinculo: "parceria", nome: "Juliana Prado" })],
    });
    expect(alertas.map((a) => a.chave)).toEqual(["parceria-contrato", "parceria-receita"]);
    expect(alertas[0].texto).toMatch(/homologado/);
    expect(alertas[1].texto).toMatch(/contador/);
  });

  it("quem foi removido não conta", () => {
    expect(
      alertasDaEquipe({ ehMei: true, hoje, colaboradores: [pessoa({ vinculo: "parceria", removido: true })] }),
    ).toEqual([]);
  });
});
