import "server-only";

import { deDataPura, diferencaEmDias } from "@/lib/formato";

import { brl, ferramenta, type Validacao } from "./base";

export type CobrancaAberta = { valorCentavos: number; vencimento: Date };
export type ContaAPagar = { valorCentavos: number | null; data: Date; tipo: string };

function somar(lista: { valorCentavos: number | null }[]) {
  return lista.reduce((t, item) => t + (item.valorCentavos ?? 0), 0);
}

/**
 * Retrato de hoje: o que os clientes devem ao estúdio e o que o estúdio tem a
 * pagar. Só totais e quantidades; nenhum nome de cliente nem descrição de conta.
 */
export function resumirCobrancasEVencimentos(params: {
  hoje: Date;
  cobrancasAbertas: CobrancaAberta[];
  recebidasNos30Dias: { valorCentavos: number }[];
  contas: ContaAPagar[];
}) {
  const dias = (data: Date) => diferencaEmDias(params.hoje, data);
  const atrasadas = params.cobrancasAbertas.filter((c) => dias(c.vencimento) < 0);
  const em7 = params.cobrancasAbertas.filter((c) => dias(c.vencimento) >= 0 && dias(c.vencimento) <= 7);

  const contas = params.contas.filter((c) => c.tipo === "conta");
  const prazos = params.contas.filter((c) => c.tipo === "prazo");
  const contasAtrasadas = contas.filter((c) => dias(c.data) < 0);
  const contas7 = contas.filter((c) => dias(c.data) >= 0 && dias(c.data) <= 7);
  const contas30 = contas.filter((c) => dias(c.data) >= 0 && dias(c.data) <= 30);

  return {
    hoje: params.hoje.toISOString().slice(0, 10),
    base: "Situação de hoje. A receber = cobranças em aberto feitas aos clientes no Bossa. A pagar = contas cadastradas em Vencimentos e ainda não pagas.",
    a_receber: {
      total_em_aberto: brl(somar(params.cobrancasAbertas)),
      cobrancas_em_aberto: params.cobrancasAbertas.length,
      atrasado: brl(somar(atrasadas)),
      cobrancas_atrasadas: atrasadas.length,
      vence_nos_proximos_7_dias: brl(somar(em7)),
      recebido_nos_ultimos_30_dias: brl(somar(params.recebidasNos30Dias)),
    },
    a_pagar: {
      contas_atrasadas: brl(somar(contasAtrasadas)),
      quantidade_atrasadas: contasAtrasadas.length,
      vence_nos_proximos_7_dias: brl(somar(contas7)),
      vence_nos_proximos_30_dias: brl(somar(contas30)),
      quantidade_nos_proximos_30_dias: contas30.length,
    },
    prazos_de_contrato_nos_proximos_60_dias: prazos.filter((p) => dias(p.data) >= 0 && dias(p.data) <= 60).length,
  };
}

/** Não recebe nada: é sempre o retrato de hoje. Qualquer entrada é ignorada. */
function validarNada(): Validacao<Record<string, never>> {
  return { ok: true, dados: {} };
}

export const cobrancasEVencimentos = ferramenta({
  nome: "cobrancas_e_vencimentos",
  descricao:
    "Retrato de hoje do dinheiro a receber e a pagar: total em aberto e atrasado das cobranças feitas aos clientes, o que vence nos próximos 7 dias, o recebido nos últimos 30 dias, as contas a pagar atrasadas e as que vencem em 7 e 30 dias. Só totais. Use para perguntas sobre inadimplência, caixa dos próximos dias e contas a pagar.",
  status: "Conferindo cobranças e vencimentos…",
  esquema: { type: "object", properties: {}, additionalProperties: false },
  validar: validarNada,
  async executar(_entrada, ctx) {
    const hoje = deDataPura(ctx.hoje)!;
    const ha30Dias = new Date(hoje.getTime() - 30 * 86_400_000);
    const em60Dias = new Date(hoje.getTime() + 60 * 86_400_000);
    const [abertas, recebidas, contas] = await Promise.all([
      ctx.db.cobranca.findMany({
        where: { usuarioId: ctx.usuarioId, situacao: "aberta" },
        select: { valorCentavos: true, vencimento: true },
      }),
      ctx.db.cobranca.findMany({
        where: { usuarioId: ctx.usuarioId, situacao: "paga", pagaEm: { gte: ha30Dias, lte: hoje } },
        select: { valorCentavos: true },
      }),
      ctx.db.vencimento.findMany({
        where: { usuarioId: ctx.usuarioId, pago: false, data: { lte: em60Dias } },
        select: { valorCentavos: true, data: true, tipo: true },
      }),
    ]);
    return resumirCobrancasEVencimentos({ hoje, cobrancasAbertas: abertas, recebidasNos30Dias: recebidas, contas });
  },
});
