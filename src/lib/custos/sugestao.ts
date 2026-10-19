import type { DespesaParaCusto, Natureza } from "./calculo";
import { classificarPorRegra, ehRetirada, motivoParaGravar } from "./regras";

/**
 * O plano do botão "Sugerir classificação": quais despesas do mês ainda
 * precisam de natureza, quais a regra resolve sem sair do servidor e quais
 * sobram para a IA.
 *
 * Despesa que já tem natureza fica de fora, venha ela da dona, de uma regra ou
 * de uma sugestão anterior. É isso que garante que o botão nunca passa por
 * cima do que a pessoa marcou.
 */

export function precisaDeSugestao(despesa: DespesaParaCusto) {
  return despesa.natureza === null && !ehRetirada(despesa);
}

export type ClassificacaoParaGravar = { id: string; natureza: Natureza; motivo: string };

export type PlanoDeSugestao = {
  porRegra: ClassificacaoParaGravar[];
  /** Maiores primeiro: se a franquia não der para todas, as que mais pesam vão antes. */
  paraIa: DespesaParaCusto[];
};

export function planejarSugestao(params: {
  mes: string;
  despesas: DespesaParaCusto[];
}): PlanoDeSugestao {
  const porRegra: ClassificacaoParaGravar[] = [];
  const paraIa: DespesaParaCusto[] = [];
  for (const despesa of params.despesas) {
    if (despesa.mes !== params.mes || !precisaDeSugestao(despesa)) continue;
    const regra = classificarPorRegra(despesa);
    if (regra) {
      porRegra.push({ id: despesa.id, natureza: regra.natureza, motivo: motivoParaGravar(regra.motivo) });
    } else {
      paraIa.push(despesa);
    }
  }
  paraIa.sort((a, b) => b.valorCentavos - a.valorCentavos);
  return { porRegra, paraIa };
}

export type MotivoSemIa = "nao_configurada" | "franquia" | "proxima_rodada" | "erro";

/** Por que sobrou despesa sem classificação depois de chamar a IA. */
export function motivoDoQueSobrou(params: {
  erroDaIa: string | null;
  enviados: number;
  total: number;
  /** A franquia do mês não cobria todas as despesas pedidas. */
  limitadoPelaFranquia: boolean;
  /** A divisão de um lote recusado parou no prazo do clique. */
  interrompido?: boolean;
}): MotivoSemIa {
  if (params.erroDaIa) return "erro";
  if (params.enviados < params.total) {
    return params.limitadoPelaFranquia ? "franquia" : "proxima_rodada";
  }
  if (params.interrompido) return "proxima_rodada";
  // Tudo foi enviado, mas o modelo deixou alguma sem resposta.
  return "erro";
}

const despesas = (n: number) => (n === 1 ? "1 despesa" : `${n} despesas`);

/** A frase que aparece depois do clique. */
export function resumoDaSugestao(params: {
  porRegra: number;
  porIa: number;
  /** Ficaram sem classificação por falta de IA, franquia, prazo ou erro (fora as recusadas). */
  semIa: number;
  motivoSemIa: MotivoSemIa | null;
  /** A IA não quis classificar nem sozinhas: só a dona classifica. */
  recusadas?: number;
}) {
  const recusadas = params.recusadas ?? 0;
  const partes: string[] = [];
  if (params.porRegra > 0) {
    partes.push(
      params.porRegra === 1
        ? "1 despesa classificada por regra"
        : `${params.porRegra} despesas classificadas por regra`,
    );
  }
  if (params.porIa > 0) {
    partes.push(params.porIa === 1 ? "1 sugestão da IA" : `${params.porIa} sugestões da IA`);
  }
  if (partes.length === 0 && params.semIa === 0 && recusadas === 0) {
    return "Nenhuma despesa nova para classificar.";
  }
  let frase = partes.length > 0 ? `${partes.join(" e ")}.` : "";
  if (params.semIa > 0) {
    const restam = params.semIa === 1 ? "1 despesa ficou" : `${params.semIa} despesas ficaram`;
    if (params.motivoSemIa === "nao_configurada") {
      // A IA está desligada no servidor: a frase não fala dela.
      frase += ` ${restam} sem classificação: as regras automáticas não reconheceram. Classifique na lista.`;
    } else if (params.motivoSemIa === "franquia") {
      frase += ` ${restam} sem classificação: a franquia de IA do mês acabou.`;
    } else if (params.motivoSemIa === "proxima_rodada") {
      frase += ` ${restam} para a próxima rodada: toque de novo para continuar.`;
    } else {
      frase += ` ${restam} sem classificação. Classifique na lista ou tente de novo.`;
    }
  }
  if (recusadas > 0) {
    frase += ` A IA não sugeriu nada para ${despesas(recusadas)}: classifique na lista.`;
  }
  return frase.trim();
}

/** O texto ao lado do botão "Sugerir classificação". */
export function textoDasPendentes(params: { total: number; pendentes: number }) {
  if (params.total === 0) return "Nenhuma despesa neste mês para classificar.";
  if (params.pendentes === 0) return "Todas as despesas do mês já estão classificadas.";
  return params.pendentes === 1
    ? "1 despesa sem classificação."
    : `${params.pendentes} despesas sem classificação.`;
}
