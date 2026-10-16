import "server-only";

import { ehTipoDePagamento, ehVinculo, ROTULO_DO_PAGAMENTO, SOBRE_O_VINCULO } from "@/lib/equipe";
import { deDataPura } from "@/lib/formato";

import { brl, ESQUEMA_MES, ferramenta, percentual, periodoDoMes, validarMes } from "./base";

export type ColaboradorDaContagem = { vinculo: string; inicio: string; fim: string | null };
export type PagamentoDaContagem = { tipo: string; valorCentavos: number };

/**
 * Equipe em números: quantos por vínculo e quanto foi pago no mês por tipo.
 * Nunca nome, CPF, Pix nem valor de uma pessoa: só somas. Os valores são os que
 * a dona registrou; o Bossa não calcula folha nem encargo.
 */
export function contarEquipe(colaboradores: ColaboradorDaContagem[], pagamentos: PagamentoDaContagem[], mes: string) {
  const { inicio, fim } = periodoDoMes(mes);
  const ativos = colaboradores.filter((c) => c.inicio <= fim && (c.fim === null || c.fim >= inicio));

  const porVinculo = new Map<string, number>();
  for (const c of ativos) {
    const rotulo = ehVinculo(c.vinculo) ? SOBRE_O_VINCULO[c.vinculo].rotulo : "Outro";
    porVinculo.set(rotulo, (porVinculo.get(rotulo) ?? 0) + 1);
  }

  const porTipo = new Map<string, number>();
  for (const p of pagamentos) {
    const rotulo = ehTipoDePagamento(p.tipo) ? ROTULO_DO_PAGAMENTO[p.tipo] : "Outro";
    porTipo.set(rotulo, (porTipo.get(rotulo) ?? 0) + p.valorCentavos);
  }
  const total = pagamentos.reduce((soma, p) => soma + p.valorCentavos, 0);

  return {
    mes,
    base: "Pagamentos que a dona registrou na Equipe com este mês de referência. O Bossa não calcula folha nem encargos.",
    colaboradores_ativos_no_mes: ativos.length,
    por_vinculo: [...porVinculo.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([vinculo, quantidade]) => ({ vinculo, quantidade })),
    total_pago_a_equipe: brl(total),
    por_tipo_de_pagamento: [...porTipo.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tipo, centavos]) => ({ tipo, ...brl(centavos), participacao: percentual(centavos, total) })),
    pagamentos_registrados: pagamentos.length,
  };
}

export const equipeEmNumeros = ferramenta({
  nome: "equipe_em_numeros",
  descricao:
    "Equipe no mês: quantas pessoas ativas por tipo de vínculo e quanto foi pago à equipe por tipo de pagamento (salário, comissão, cota-parte, repasse...), só em totais. Nunca traz nome nem valor de uma pessoa. Use para perguntas sobre o peso da equipe nos custos.",
  status: "Somando os pagamentos da equipe…",
  esquema: ESQUEMA_MES,
  validar: validarMes,
  async executar({ mes }, ctx) {
    const { fim } = periodoDoMes(mes);
    const [colaboradores, pagamentos] = await Promise.all([
      // Quem saiu e foi anonimizado entra na contagem do mês em que esteve
      // ativo (só vínculo e datas), porque os pagamentos dele entram no total.
      ctx.db.colaborador.findMany({
        where: { usuarioId: ctx.usuarioId, inicio: { lte: deDataPura(fim)! } },
        select: { vinculo: true, inicio: true, fim: true },
      }),
      ctx.db.pagamentoDeColaborador.findMany({
        where: { usuarioId: ctx.usuarioId, competencia: mes },
        select: { tipo: true, valorCentavos: true },
      }),
    ]);
    return contarEquipe(
      colaboradores.map((c) => ({
        vinculo: c.vinculo,
        inicio: c.inicio.toISOString().slice(0, 10),
        fim: c.fim ? c.fim.toISOString().slice(0, 10) : null,
      })),
      pagamentos,
      mes,
    );
  },
});
