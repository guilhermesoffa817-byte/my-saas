import "server-only";

import { montarResumoDeCustos, ROTULO_DA_NATUREZA, type ResumoDeCustos } from "@/lib/custos/calculo";
import { carregarMovimento, nomesParaOcultar } from "@/lib/custos/operacoes";
import { ocultarNomes, sanitizarParaIA } from "@/lib/ia/sanitizar";

import { brl, ESQUEMA_MES, ferramenta, percentual, validarMes } from "./base";

const SITUACAO_DO_EQUILIBRIO: Record<ResumoDeCustos["situacaoDoPontoDeEquilibrio"], string> = {
  calculado: "Calculado.",
  sem_custos_fixos: "Não há custo fixo classificado no mês; não há ponto de equilíbrio a calcular.",
  sem_receita: "Nada entrou no mês; não dá para calcular.",
  margem_insuficiente: "Com a margem atual, os custos variáveis já levam tudo o que entra.",
};

/** Pontos-base (10.000 = 100%) como texto ("42,5%"). */
const pontosBase = (valor: number | null) => (valor === null ? null : percentual(valor, 10_000));

export const CATEGORIAS_NO_RESUMO = 12;

/**
 * O resumo da tela de Custos do jeito que vai para o modelo: o mesmo cálculo
 * (lib/custos/calculo.ts), em centavos com o texto em R$, e as despesas
 * somadas por categoria. Nenhuma descrição de lançamento sai daqui: a do
 * pagamento da equipe traz o nome da pessoa.
 */
export function custosParaOModelo(r: ResumoDeCustos, nomesDePessoas: string[] = []) {
  const categorias = new Map<string, { categoria: string; natureza: string; centavos: number; lancamentos: number }>();
  for (const d of r.despesas) {
    const natureza = d.natureza ? ROTULO_DA_NATUREZA[d.natureza] : "Sem classificação";
    const limpa = d.categoria ? ocultarNomes(sanitizarParaIA(d.categoria.trim()), nomesDePessoas).slice(0, 60) : "";
    const categoria = limpa || "Sem categoria";
    const chave = `${categoria}|${natureza}`;
    const atual = categorias.get(chave) ?? { categoria, natureza, centavos: 0, lancamentos: 0 };
    atual.centavos += d.valorCentavos;
    atual.lancamentos += 1;
    categorias.set(chave, atual);
  }
  const custoTotal = r.fixosCentavos + r.variaveisCentavos + r.foraDaOperacaoCentavos + r.semClassificacaoCentavos;

  return {
    mes: r.mes,
    base: "Visão gerencial dos custos do mês, pela classificação fixo, variável e fora da operação feita na tela Custos. Não substitui o resumo do contador. Retirada da dona não é custo.",
    receita: brl(r.receitaCentavos),
    atendimentos_concluidos: r.atendimentos,
    custos_fixos: brl(r.fixosCentavos),
    custos_variaveis: brl(r.variaveisCentavos),
    fora_da_operacao: brl(r.foraDaOperacaoCentavos),
    sem_classificacao: { ...brl(r.semClassificacaoCentavos), lancamentos: r.quantidadeSemClassificacao },
    retiradas_da_dona_fora_da_conta: brl(r.retiradasCentavos),
    margem_de_contribuicao: brl(r.margemDeContribuicaoCentavos),
    indice_de_margem: pontosBase(r.indiceDeMargemPontosBase),
    de_cada_100_reais_que_entram_sobram:
      r.sobraACadaCemReaisCentavos === null ? null : brl(r.sobraACadaCemReaisCentavos),
    peso_dos_custos_fixos_na_receita: pontosBase(r.pesoDosFixosPontosBase),
    ponto_de_equilibrio: {
      situacao: SITUACAO_DO_EQUILIBRIO[r.situacaoDoPontoDeEquilibrio],
      faturamento_mensal_necessario: r.pontoDeEquilibrioCentavos === null ? null : brl(r.pontoDeEquilibrioCentavos),
      atendimentos_necessarios_aproximados: r.pontoDeEquilibrioAtendimentos,
    },
    mes_anterior: {
      mes: r.mesAnterior.mes,
      receita: brl(r.mesAnterior.receitaCentavos),
      custos_fixos: brl(r.mesAnterior.fixosCentavos),
      custos_variaveis: brl(r.mesAnterior.variaveisCentavos),
      margem_de_contribuicao: brl(r.mesAnterior.margemDeContribuicaoCentavos),
    },
    tendencia_seis_meses: r.tendencia.map((m) => ({
      mes: m.mes,
      custos_fixos: brl(m.fixosCentavos),
      custos_variaveis: brl(m.variaveisCentavos),
    })),
    por_categoria: [...categorias.values()]
      .sort((a, b) => b.centavos - a.centavos)
      .slice(0, CATEGORIAS_NO_RESUMO)
      .map((c) => ({
        categoria: c.categoria,
        natureza: c.natureza,
        ...brl(c.centavos),
        participacao: percentual(c.centavos, custoTotal),
        lancamentos: c.lancamentos,
      })),
  };
}

export const custosOperacionais = ferramenta({
  nome: "custos_operacionais",
  descricao:
    "Custos de um mês separados em fixos, variáveis e fora da operação (visão gerencial da tela Custos), com margem de contribuição, ponto de equilíbrio (quanto faturar no mês para empatar e cerca de quantos atendimentos), comparação com o mês anterior, tendência de seis meses e totais por categoria. Use para perguntas sobre custo fixo, quanto precisa faturar e peso dos custos. Se muita coisa estiver sem classificação, sugira classificar na tela Custos.",
  status: "Lendo os custos do mês…",
  esquema: ESQUEMA_MES,
  validar: validarMes,
  async executar({ mes }, ctx) {
    const [movimento, nomes] = await Promise.all([
      carregarMovimento(ctx.db, ctx.usuarioId, mes),
      nomesParaOcultar(ctx.db, ctx.usuarioId),
    ]);
    return custosParaOModelo(montarResumoDeCustos({ mes, ...movimento }), nomes);
  },
});
