import "server-only";

import { paraDataLocal } from "@/lib/formato";

import {
  AVISO_CORTADO,
  brl,
  ESQUEMA_PERIODO,
  ferramenta,
  instantesDoPeriodo,
  LINHAS_MAXIMAS,
  media,
  percentual,
  somarDiasAoDia,
  validarPeriodo,
  type Periodo,
} from "./base";

export const DIAS_PARA_INATIVO = 60;

/** Um atendimento concluído. O id do cliente só serve para contar; nunca sai daqui. */
export type VisitaConcluida = { clienteId: string; dia: string; valorCentavos: number };

/**
 * Só contagens. Nenhum nome, telefone, e-mail, CPF, observação nem histórico
 * individual vai para a IA: em estética e terapia, o histórico de uma pessoa
 * já diz demais sobre ela.
 */
export function contarClientes(params: {
  visitas: VisitaConcluida[];
  periodo: Periodo;
  hoje: string;
  cadastrados: number;
  cadastradosNoPeriodo: number;
}) {
  const { periodo } = params;
  const referencia = periodo.fim < params.hoje ? periodo.fim : params.hoje;
  const corteInativo = somarDiasAoDia(referencia, -DIAS_PARA_INATIVO);

  type Cliente = { ultima: string; noPeriodo: number; valorNoPeriodo: number; antes: boolean };
  const clientes = new Map<string, Cliente>();
  for (const v of params.visitas) {
    if (v.dia > periodo.fim) continue;
    const c = clientes.get(v.clienteId) ?? { ultima: v.dia, noPeriodo: 0, valorNoPeriodo: 0, antes: false };
    if (v.dia > c.ultima) c.ultima = v.dia;
    if (v.dia >= periodo.inicio) {
      c.noPeriodo += 1;
      c.valorNoPeriodo += v.valorCentavos;
    } else c.antes = true;
    clientes.set(v.clienteId, c);
  }

  const todos = [...clientes.values()];
  const atendidos = todos.filter((c) => c.noPeriodo > 0);
  const novos = atendidos.filter((c) => !c.antes);
  const visitas = atendidos.reduce((t, c) => t + c.noPeriodo, 0);
  const valor = atendidos.reduce((t, c) => t + c.valorNoPeriodo, 0);
  const inativos = todos.filter((c) => c.ultima < corteInativo).length;

  return {
    periodo,
    base: "Só contagens de clientes com atendimento concluído; nenhum dado pessoal. Valor pelo preço atual do serviço.",
    clientes_cadastrados: params.cadastrados,
    clientes_cadastrados_no_periodo: params.cadastradosNoPeriodo,
    clientes_atendidos_no_periodo: atendidos.length,
    clientes_novos: novos.length,
    clientes_que_voltaram: atendidos.length - novos.length,
    novos_que_voltaram_dentro_do_periodo: novos.filter((c) => c.noPeriodo > 1).length,
    atendimentos_concluidos_no_periodo: visitas,
    frequencia_media_por_cliente: atendidos.length > 0 ? Math.round((visitas * 10) / atendidos.length) / 10 : null,
    valor_medio_por_cliente: brl(media(valor, atendidos.length)),
    inativos: {
      criterio: `Último atendimento concluído há mais de ${DIAS_PARA_INATIVO} dias (contando de ${referencia}).`,
      quantidade: inativos,
      participacao_entre_quem_ja_foi_atendido: percentual(inativos, todos.length),
    },
    clientes_com_algum_atendimento_concluido: todos.length,
  };
}

export const clientesEmNumeros = ferramenta({
  nome: "clientes_em_numeros",
  descricao: `Só contagens de clientes no período: cadastrados, atendidos, novos, que voltaram, inativos há mais de ${DIAS_PARA_INATIVO} dias, frequência média e valor médio por cliente. Nunca traz nome nem contato. Use para perguntas sobre retenção, clientes que sumiram e base de clientes.`,
  status: "Contando os clientes…",
  esquema: ESQUEMA_PERIODO,
  validar: validarPeriodo,
  async executar(periodo, ctx) {
    const { de, ate } = instantesDoPeriodo(periodo);
    // Todo o histórico até o fim do período: é ele que diz quem é novo e quem sumiu.
    const [visitas, cadastrados, cadastradosNoPeriodo] = await Promise.all([
      ctx.db.agendamento.findMany({
        where: { usuarioId: ctx.usuarioId, status: "concluido", inicio: { lt: ate } },
        orderBy: { inicio: "desc" },
        select: { clienteId: true, inicio: true, servico: { select: { precoCentavos: true } } },
        take: LINHAS_MAXIMAS,
      }),
      ctx.db.cliente.count({ where: { usuarioId: ctx.usuarioId } }),
      ctx.db.cliente.count({ where: { usuarioId: ctx.usuarioId, criadoEm: { gte: de, lt: ate } } }),
    ]);
    const resultado = contarClientes({
      visitas: visitas.map((v) => ({
        clienteId: v.clienteId,
        dia: paraDataLocal(v.inicio),
        valorCentavos: v.servico.precoCentavos,
      })),
      periodo,
      hoje: ctx.hoje,
      cadastrados,
      cadastradosNoPeriodo,
    });
    return visitas.length >= LINHAS_MAXIMAS ? { ...resultado, aviso: AVISO_CORTADO } : resultado;
  },
});
