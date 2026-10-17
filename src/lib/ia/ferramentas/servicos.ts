import "server-only";

import { nomesParaOcultar } from "@/lib/custos/operacoes";
import { ocultarNomes, sanitizarParaIA } from "@/lib/ia/sanitizar";

import {
  AVISO_CORTADO,
  brl,
  ESQUEMA_PERIODO,
  ferramenta,
  instantesDoPeriodo,
  LINHAS_MAXIMAS,
  percentual,
  validarPeriodo,
  type Periodo,
} from "./base";

export type ServicoDoCatalogo = {
  id: string;
  nome: string;
  precoCentavos: number;
  duracaoMin: number;
  ativo: boolean;
};

export type AtendimentoDoServico = {
  servicoId: string;
  status: string;
  /** Já passou do horário? Agendado que passou sem conclusão conta à parte. */
  passou: boolean;
};

/**
 * Desempenho por serviço no período. A receita é a mesma da página Finanças:
 * preço do serviço vezes atendimentos concluídos. Só nomes de serviço e
 * números; nada de cliente nem de quem atendeu.
 */
export function analisarServicos(params: {
  servicos: ServicoDoCatalogo[];
  atendimentos: AtendimentoDoServico[];
  periodo: Periodo;
  nomesDePessoas?: string[];
}) {
  const nomes = params.nomesDePessoas ?? [];
  type Soma = { marcados: number; concluidos: number; cancelados: number; semConclusao: number };
  const somas = new Map<string, Soma>();
  for (const a of params.atendimentos) {
    const s = somas.get(a.servicoId) ?? { marcados: 0, concluidos: 0, cancelados: 0, semConclusao: 0 };
    s.marcados += 1;
    if (a.status === "concluido") s.concluidos += 1;
    else if (a.status === "cancelado") s.cancelados += 1;
    else if (a.passou) s.semConclusao += 1;
    somas.set(a.servicoId, s);
  }

  const porId = new Map(params.servicos.map((s) => [s.id, s]));
  const receitaDe = (id: string) => (porId.get(id)?.precoCentavos ?? 0) * (somas.get(id)?.concluidos ?? 0);
  const receitaTotal = [...somas.keys()].reduce((t, id) => t + receitaDe(id), 0);
  const nomeLimpo = (nome: string) => ocultarNomes(sanitizarParaIA(nome), nomes).slice(0, 80);

  const desempenho = [...somas.entries()]
    .map(([id, s]) => {
      const servico = porId.get(id);
      const receita = receitaDe(id);
      const minutos = (servico?.duracaoMin ?? 0) * s.concluidos;
      return {
        servico: servico ? nomeLimpo(servico.nome) : "Serviço removido",
        atendimentos_marcados: s.marcados,
        atendimentos_concluidos: s.concluidos,
        cancelamentos: s.cancelados,
        passaram_sem_conclusao: s.semConclusao,
        receita: brl(receita),
        participacao_na_receita: percentual(receita, receitaTotal),
        preco_atual: servico ? brl(servico.precoCentavos) : null,
        duracao_cadastrada_min: servico?.duracaoMin ?? null,
        // Quanto cada hora de agenda ocupada por este serviço trouxe.
        receita_por_hora_de_agenda: minutos > 0 ? brl(Math.round((receita * 60) / minutos)) : null,
      };
    })
    .sort((a, b) => b.receita.centavos - a.receita.centavos || b.atendimentos_concluidos - a.atendimentos_concluidos);

  const semVenda = params.servicos
    .filter((s) => s.ativo && !somas.get(s.id)?.concluidos)
    .map((s) => ({ servico: nomeLimpo(s.nome), preco_atual: brl(s.precoCentavos), duracao_min: s.duracaoMin }));

  return {
    periodo: params.periodo,
    base: "Atendimentos com horário no período. Receita = preço atual do serviço × atendimentos concluídos, como na página Finanças. \"Passaram sem conclusão\" são horários que já passaram e não foram marcados como concluídos nem cancelados (podem ser faltas ou só falta de atualizar a agenda).",
    receita_total_dos_servicos: brl(receitaTotal),
    atendimentos_concluidos: desempenho.reduce((t, d) => t + d.atendimentos_concluidos, 0),
    por_servico: desempenho,
    servicos_ativos_sem_atendimento_concluido: semVenda,
  };
}

export const desempenhoDosServicos = ferramenta({
  nome: "desempenho_dos_servicos",
  descricao:
    "Desempenho de cada serviço no período: atendimentos marcados e concluídos, cancelamentos, receita, participação na receita, preço, duração e receita por hora de agenda; e os serviços ativos sem nenhum atendimento concluído. Use para perguntas sobre o que mais dá resultado, preço e mix de serviços.",
  status: "Analisando os serviços…",
  esquema: ESQUEMA_PERIODO,
  validar: validarPeriodo,
  async executar(periodo, ctx) {
    const { de, ate } = instantesDoPeriodo(periodo);
    const agora = new Date();
    const [catalogo, atendimentos, nomes] = await Promise.all([
      ctx.db.servico.findMany({
        where: { usuarioId: ctx.usuarioId },
        select: { id: true, nome: true, precoCentavos: true, duracaoMin: true, ativo: true },
      }),
      ctx.db.agendamento.findMany({
        where: { usuarioId: ctx.usuarioId, inicio: { gte: de, lt: ate } },
        select: { servicoId: true, status: true, inicio: true },
        take: LINHAS_MAXIMAS,
      }),
      nomesParaOcultar(ctx.db, ctx.usuarioId),
    ]);
    const resultado = analisarServicos({
      servicos: catalogo,
      atendimentos: atendimentos.map((a) => ({
        servicoId: a.servicoId,
        status: a.status,
        passou: a.inicio.getTime() < agora.getTime(),
      })),
      periodo,
      nomesDePessoas: nomes,
    });
    return atendimentos.length >= LINHAS_MAXIMAS ? { ...resultado, aviso: AVISO_CORTADO } : resultado;
  },
});
