/**
 * As regras dos vencimentos que não dependem do banco.
 *
 * Vencimento é tudo o que tem data e cobra uma atitude: a conta de luz, o
 * aluguel, o fim do contrato, o dia do reajuste. Conta com data futura não é
 * dinheiro que já saiu: ela só vira saída no financeiro quando alguém disser
 * que pagou.
 */

import {
  diferencaEmDias,
  paraDataPura,
  somarDiasPuros,
  ultimoDiaDoMes,
} from "@/lib/formato";

/** Conta a pagar ou prazo de contrato. */
export type TipoDeVencimento = "conta" | "prazo";

export type SituacaoDoVencimento = "a_pagar" | "vence_hoje" | "atrasado" | "pago";

export function situacaoDoVencimento(
  vencimento: { pago: boolean; data: Date },
  hoje: Date,
): SituacaoDoVencimento {
  if (vencimento.pago) return "pago";
  const dias = diferencaEmDias(hoje, vencimento.data);
  if (dias === 0) return "vence_hoje";
  return dias < 0 ? "atrasado" : "a_pagar";
}

/**
 * O aviso que aparece na lista. Prazo de contrato avisa com trinta dias de
 * antecedência, porque é o prazo que a maioria dos contratos pede para quem
 * quer sair ou renegociar.
 */
export const DIAS_DE_AVISO_DO_PRAZO = 30;

export function avisoDoVencimento(
  vencimento: { pago: boolean; data: Date; tipo: TipoDeVencimento },
  hoje: Date,
): string | null {
  if (vencimento.pago) return null;
  const dias = diferencaEmDias(hoje, vencimento.data);

  if (dias < 0) {
    const atraso = Math.abs(dias);
    return atraso === 1 ? "Venceu ontem" : `Venceu há ${atraso} dias`;
  }
  if (dias === 0) return "Vence hoje";
  if (dias === 1) return "Vence amanhã";

  const janela = vencimento.tipo === "prazo" ? DIAS_DE_AVISO_DO_PRAZO : 7;
  return dias <= janela ? `Vence em ${dias} dias` : null;
}

/* ------------------------------------------------------------------ */
/* Repetição mensal                                                    */
/* ------------------------------------------------------------------ */

/** Quantos meses o Bossa mantém adiantados quando não há data final. */
export const MESES_ADIANTADOS = 12;

/**
 * As datas de uma repetição mensal.
 *
 * O dia escolhido é o dia de referência, não o dia literal: quem vence dia 31
 * vence dia 28 em fevereiro, não dia 3 de março. Por isso a conta é feita com
 * ano, mês e dia separados, e o dia é limitado ao último do mês. Somar trinta
 * dias daria errado em metade do ano.
 */
export function ocorrenciasMensais({
  primeira,
  ate,
  quantasNoMaximo = MESES_ADIANTADOS,
}: {
  primeira: Date;
  /** Data final do combinado. Sem ela, o Bossa mantém os próximos doze meses. */
  ate?: Date | null;
  quantasNoMaximo?: number;
}): Date[] {
  const [ano, mes, dia] = paraDataPura(primeira).split("-").map(Number);
  const datas: Date[] = [];

  for (let passo = 0; passo < quantasNoMaximo; passo++) {
    const mesCorrido = mes - 1 + passo;
    const anoDaVez = ano + Math.floor(mesCorrido / 12);
    const mesDaVez = (mesCorrido % 12) + 1;
    const diaDaVez = Math.min(dia, ultimoDiaDoMes(anoDaVez, mesDaVez));

    const data = new Date(
      Date.UTC(anoDaVez, mesDaVez - 1, diaDaVez),
    );

    if (ate && diferencaEmDias(ate, data) > 0) break;
    datas.push(data);
  }

  return datas;
}

/**
 * Quais ocorrências ainda faltam gravar.
 *
 * Roda quando a tela abre, não numa tarefa agendada: o Bossa compara o que
 * deveria existir com o que existe e devolve a diferença.
 */
export function ocorrenciasQueFaltam({
  primeira,
  ate,
  jaGravadas,
  hoje,
}: {
  primeira: Date;
  ate?: Date | null;
  jaGravadas: Date[];
  hoje: Date;
}): Date[] {
  const existentes = new Set(jaGravadas.map((data) => paraDataPura(data)));

  /*
    Sem data final, a janela acompanha o tempo: doze meses contados do mês atual,
    e não do mês em que a conta foi criada. Sem isso, uma conta criada há dois
    anos pararia de gerar ocorrência.
  */
  const inicio = diferencaEmDias(hoje, primeira) > 0 ? primeira : primeiraDepoisDe(primeira, hoje);

  return ocorrenciasMensais({ primeira: inicio, ate, quantasNoMaximo: MESES_ADIANTADOS })
    .filter((data) => !existentes.has(paraDataPura(data)));
}

/** A primeira ocorrência da repetição que cai hoje ou depois de hoje. */
function primeiraDepoisDe(primeira: Date, hoje: Date) {
  const [anoP, mesP, diaP] = paraDataPura(primeira).split("-").map(Number);
  const [anoH, mesH] = paraDataPura(hoje).split("-").map(Number);

  let mesCorrido = (anoH - anoP) * 12 + (mesH - mesP);
  if (mesCorrido < 0) mesCorrido = 0;

  for (let passo = mesCorrido; passo < mesCorrido + 2; passo++) {
    const anoDaVez = anoP + Math.floor((mesP - 1 + passo) / 12);
    const mesDaVez = ((mesP - 1 + passo) % 12) + 1;
    const diaDaVez = Math.min(diaP, ultimoDiaDoMes(anoDaVez, mesDaVez));
    const data = new Date(Date.UTC(anoDaVez, mesDaVez - 1, diaDaVez));
    if (diferencaEmDias(hoje, data) >= 0) return data;
  }

  return somarDiasPuros(hoje, 0);
}
