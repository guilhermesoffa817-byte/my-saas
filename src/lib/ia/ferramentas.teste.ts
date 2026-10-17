import { describe, expect, it } from "vitest";
import { analisarAgenda, diasDaSemanaNoPeriodo } from "./ferramentas/agenda";
import { periodoAnterior, periodoDoMes, validarMes, validarPeriodo, variacao } from "./ferramentas/base";
import { contarClientes } from "./ferramentas/clientes";
import { resumirCobrancasEVencimentos } from "./ferramentas/cobrancas";
import { contarEquipe } from "./ferramentas/equipe";
import { resumirFinanceiro, type MovimentoDoResumo } from "./ferramentas/financeiro";
import { analisarServicos } from "./ferramentas/servicos";
import { ferramentasDaApi, FERRAMENTAS, statusDaFerramenta } from "./ferramentas";
import { mensagemDoUsuario, montarSistema, RAMO_NEUTRO } from "./sistema";

describe("períodos das ferramentas", () => {
  it("meses inteiros comparam com os meses civis anteriores; o resto, com os mesmos dias logo antes", () => {
    expect(periodoAnterior({ inicio: "2026-09-01", fim: "2026-09-30" })).toEqual({ inicio: "2026-08-01", fim: "2026-08-31" });
    expect(periodoAnterior({ inicio: "2026-03-01", fim: "2026-03-31" })).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
    expect(periodoAnterior({ inicio: "2026-07-01", fim: "2026-09-30" })).toEqual({ inicio: "2026-04-01", fim: "2026-06-30" });
    expect(periodoAnterior({ inicio: "2026-10-01", fim: "2026-10-16" })).toEqual({ inicio: "2026-09-15", fim: "2026-09-30" });
    expect(periodoDoMes("2028-02")).toEqual({ inicio: "2028-02-01", fim: "2028-02-29" });
  });

  it("aceita até 24 meses, recusa data impossível, invertida ou fora do formato", () => {
    expect(validarPeriodo({ inicio: "2024-10-17", fim: "2026-10-16" }).ok).toBe(true);
    expect(validarPeriodo({ inicio: "2024-10-16", fim: "2026-10-16" }).ok).toBe(false);
    expect(validarPeriodo({ inicio: "2026-02-30", fim: "2026-03-10" }).ok).toBe(false);
    expect(validarPeriodo({ inicio: "2026-10-10", fim: "2026-10-01" }).ok).toBe(false);
    expect(validarPeriodo({ inicio: "01/10/2026", fim: "2026-10-01" }).ok).toBe(false);
    expect(validarPeriodo(null).ok).toBe(false);
    expect(validarMes({ mes: "2026-13" }).ok).toBe(false);
    expect(validarMes({ mes: "2026-09" })).toEqual({ ok: true, dados: { mes: "2026-09" } });
  });

  it("variação em texto, sem dividir por zero", () => {
    expect(variacao(150, 100)).toBe("+50%");
    expect(variacao(50, 100)).toBe("-50%");
    expect(variacao(10, 0)).toBe("sem base de comparação");
    expect(variacao(0, 0)).toBe("sem variação");
  });
});

describe("resumo financeiro", () => {
  const mov = (m: Partial<MovimentoDoResumo>): MovimentoDoResumo => ({
    tipo: "saida",
    valorCentavos: 0,
    dia: "2026-09-10",
    categoria: null,
    descricao: "",
    atendimento: false,
    ...m,
  });

  it("separa a retirada da dona, compara com o mês anterior e esconde nomes das categorias", () => {
    const resumo = resumirFinanceiro({
      movimentos: [
        mov({ tipo: "entrada", valorCentavos: 12000, atendimento: true }),
        mov({ tipo: "entrada", valorCentavos: 8000, atendimento: true }),
        mov({ tipo: "entrada", valorCentavos: 5000, categoria: "Venda de produto" }),
        mov({ valorCentavos: 3000, categoria: "Produtos" }),
        mov({ valorCentavos: 100000, descricao: "Retirada", categoria: "Pró-labore" }),
        mov({ valorCentavos: 2000, categoria: "Vale Carla Dias 123.456.789-09" }),
        mov({ tipo: "entrada", valorCentavos: 10000, atendimento: true, dia: "2026-08-10" }),
      ],
      periodo: { inicio: "2026-09-01", fim: "2026-09-30" },
      primeiroDia: "2026-09-25",
      hoje: "2026-10-16",
      nomesDePessoas: ["Carla Dias"],
    });
    expect(resumo.entradas.centavos).toBe(25000);
    expect(resumo.entradas.texto).toMatch(/^R\$\s250,00$/);
    expect(resumo.entradas_de_atendimentos.centavos).toBe(20000);
    expect(resumo.atendimentos_concluidos).toBe(2);
    expect(resumo.ticket_medio_por_atendimento.centavos).toBe(10000);
    expect(resumo.saidas.centavos).toBe(5000);
    expect(resumo.retiradas_da_dona.centavos).toBe(100000);
    expect(resumo.resultado.centavos).toBe(20000);
    expect(resumo.periodo_anterior.entradas.centavos).toBe(10000);
    expect(resumo.variacao_sobre_o_periodo_anterior.entradas).toBe("+150%");
    expect(resumo.historico.poucos_dados).toBe(true);
    const texto = JSON.stringify(resumo);
    expect(texto).not.toContain("Carla");
    expect(texto).not.toContain("123.456");
    expect(texto).toContain("Vale [nome] [cpf]");
  });
});

describe("agenda, serviços, clientes, cobranças e equipe", () => {
  it("agenda por dia da semana e faixa de horário, segunda primeiro", () => {
    const resultado = analisarAgenda(
      [
        { status: "concluido", local: "2026-10-05T09:00", duracaoMin: 60, passou: true }, // segunda
        { status: "agendado", local: "2026-10-05T14:00", duracaoMin: 30, passou: true },
        { status: "cancelado", local: "2026-10-06T19:00", duracaoMin: 60, passou: true }, // terça
        { status: "agendado", local: "2026-10-10T19:00", duracaoMin: 60, passou: false }, // sábado
      ],
      { inicio: "2026-10-05", fim: "2026-10-11" },
    );
    expect(resultado.por_situacao).toEqual({ concluidos: 1, cancelados: 1, passaram_sem_conclusao: 1, ainda_por_vir: 1 });
    expect(resultado.por_dia_da_semana[0]).toMatchObject({ dia: "Segunda-feira", horarios_marcados: 2, horas_marcadas: 1.5 });
    expect(resultado.por_dia_da_semana[1]).toMatchObject({ dia: "Terça-feira", horarios_marcados: 0, cancelados: 1 });
    expect(resultado.por_faixa_de_horario.map((f) => f.horarios_marcados)).toEqual([1, 1, 1]);
    expect(diasDaSemanaNoPeriodo({ inicio: "2026-10-01", fim: "2026-10-31" })[4]).toBe(5); // quintas de outubro
  });

  it("serviços: receita pelo preço vezes concluídos e os que não venderam", () => {
    const resultado = analisarServicos({
      servicos: [
        { id: "s1", nome: "Escova", precoCentavos: 8000, duracaoMin: 60, ativo: true },
        { id: "s2", nome: "Hidratação", precoCentavos: 12000, duracaoMin: 90, ativo: true },
      ],
      atendimentos: [
        { servicoId: "s1", status: "concluido", passou: true },
        { servicoId: "s1", status: "concluido", passou: true },
        { servicoId: "s1", status: "cancelado", passou: true },
        { servicoId: "s2", status: "agendado", passou: true },
      ],
      periodo: { inicio: "2026-09-01", fim: "2026-09-30" },
    });
    expect(resultado.por_servico[0]).toMatchObject({
      servico: "Escova",
      atendimentos_concluidos: 2,
      cancelamentos: 1,
      receita: { centavos: 16000 },
      receita_por_hora_de_agenda: { centavos: 8000 },
    });
    expect(resultado.servicos_ativos_sem_atendimento_concluido.map((s) => s.servico)).toEqual(["Hidratação"]);
  });

  it("clientes: só contagens, novos, que voltaram e inativos há 60 dias", () => {
    const resultado = contarClientes({
      visitas: [
        { clienteId: "c1", dia: "2026-06-01", valorCentavos: 8000 },
        { clienteId: "c1", dia: "2026-09-10", valorCentavos: 8000 },
        { clienteId: "c2", dia: "2026-09-12", valorCentavos: 12000 },
        { clienteId: "c2", dia: "2026-09-20", valorCentavos: 12000 },
        { clienteId: "c3", dia: "2026-05-01", valorCentavos: 8000 },
      ],
      periodo: { inicio: "2026-09-01", fim: "2026-09-30" },
      hoje: "2026-10-16",
      cadastrados: 10,
      cadastradosNoPeriodo: 2,
    });
    expect(resultado).toMatchObject({
      clientes_atendidos_no_periodo: 2,
      clientes_novos: 1,
      clientes_que_voltaram: 1,
      novos_que_voltaram_dentro_do_periodo: 1,
      atendimentos_concluidos_no_periodo: 3,
      inativos: { quantidade: 1 },
    });
    expect(JSON.stringify(resultado)).not.toMatch(/c1|c2|c3/);
  });

  it("cobranças e vencimentos: atrasado, próximos dias e prazos, só totais", () => {
    const dia = (d: string) => new Date(`${d}T00:00:00.000Z`);
    const resultado = resumirCobrancasEVencimentos({
      hoje: dia("2026-10-16"),
      cobrancasAbertas: [
        { valorCentavos: 10000, vencimento: dia("2026-10-10") },
        { valorCentavos: 5000, vencimento: dia("2026-10-20") },
      ],
      recebidasNos30Dias: [{ valorCentavos: 7000 }],
      contas: [
        { valorCentavos: 180000, data: dia("2026-10-15"), tipo: "conta" },
        { valorCentavos: 30000, data: dia("2026-11-10"), tipo: "conta" },
        { valorCentavos: null, data: dia("2026-11-30"), tipo: "prazo" },
      ],
    });
    expect(resultado.a_receber).toMatchObject({
      total_em_aberto: { centavos: 15000 },
      atrasado: { centavos: 10000 },
      vence_nos_proximos_7_dias: { centavos: 5000 },
    });
    expect(resultado.a_pagar).toMatchObject({ contas_atrasadas: { centavos: 180000 }, vence_nos_proximos_30_dias: { centavos: 30000 } });
    expect(resultado.prazos_de_contrato_nos_proximos_60_dias).toBe(1);
  });

  it("equipe: por vínculo e por tipo de pagamento, nunca por pessoa", () => {
    const resultado = contarEquipe(
      [
        { vinculo: "clt", inicio: "2026-01-01", fim: null },
        { vinculo: "parceria", inicio: "2026-09-15", fim: null },
        { vinculo: "mei", inicio: "2025-01-01", fim: "2026-08-31" },
      ],
      [
        { tipo: "salario", valorCentavos: 231700 },
        { tipo: "cota_parte", valorCentavos: 90000 },
      ],
      "2026-09",
    );
    expect(resultado.colaboradores_ativos_no_mes).toBe(2);
    expect(resultado.total_pago_a_equipe.centavos).toBe(321700);
    expect(resultado.por_tipo_de_pagamento.map((p) => p.tipo)).toEqual(["Salário", "Cota-parte"]);
  });
});

describe("pedido à API", () => {
  it("lista fixa de ferramentas, com a pesquisa limitada e localizada só pela cidade", () => {
    const lista = ferramentasDaApi({ cidade: "Cuiabá" });
    expect(lista.map((f) => ("name" in f ? f.name : null))).toEqual([...FERRAMENTAS.map((f) => f.nome), "web_search"]);
    expect(lista.at(-1)).toEqual({
      type: "web_search_20260209",
      name: "web_search",
      max_uses: 5,
      user_location: { type: "approximate", country: "BR", timezone: "America/Sao_Paulo", city: "Cuiabá" },
    });
    expect(JSON.stringify(ferramentasDaApi({ cidade: null }))).not.toContain("city");
    expect(statusDaFerramenta("resumo_financeiro")).toBe("Lendo o financeiro…");
    expect(statusDaFerramenta("web_search")).toBe("Pesquisando tendências…");
  });

  it("sistema sem data e sem nome do estúdio; ramo neutro quando não há; data só na pergunta", () => {
    const sistema = montarSistema({ ramo: null, cidade: "Cuiabá" });
    expect(sistema).toContain(RAMO_NEUTRO);
    expect(sistema).toContain("Cuiabá");
    expect(sistema).not.toMatch(/20\d\d/);
    expect(sistema).toContain("Próximos passos");
    expect(montarSistema({ ramo: "barbearia", cidade: null })).toBe(montarSistema({ ramo: "barbearia", cidade: null }));
    expect(mensagemDoUsuario("Como foi setembro?", "2026-10-16")).toBe(
      "Hoje é sexta-feira, 16/10/2026 (2026-10-16), no horário de Brasília.\n\nComo foi setembro?",
    );
  });
});
