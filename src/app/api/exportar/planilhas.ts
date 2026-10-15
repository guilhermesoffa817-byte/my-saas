/**
 * O que vai em cada planilha de "Baixar meus dados".
 *
 * Os dados são de quem cuida do estúdio, e ela pode levá-los quando quiser:
 * para o contador, para outra ferramenta, ou só para ter uma cópia em casa.
 * Por isso a planilha de clientes traz também as arquivadas. Arquivar tira da
 * lista do dia a dia, não apaga a história.
 *
 * Toda consulta daqui filtra pelo estúdio recebido, e esse id vem sempre da
 * sessão, na rota. As funções recebem o cliente do Prisma por parâmetro para
 * que o teste de banco percorra exatamente as mesmas consultas.
 */

import type { PrismaClient } from "@/generated/prisma";
import {
  ROTULO_DA_SITUACAO,
  situacaoValida,
  valorDoAtendimento,
} from "@/lib/atendimento";
import { situacaoDaCobranca } from "@/lib/cobranca";
import { situacaoDoVencimento } from "@/lib/vencimento";
import { hojeNoEstudio } from "@/lib/formato";
import { ROTULO_DA_COBRANCA, ROTULO_DO_VENCIMENTO } from "@/componentes/ui/etiqueta";
import {
  dataCsv,
  dataPuraCsv,
  dinheiroCsv,
  horaCsv,
  montarCsv,
  type Celula,
} from "@/lib/csv";

export const TIPOS_DE_PLANILHA = [
  "clientes",
  "atendimentos",
  "cobrancas",
  "lancamentos",
  "vencimentos",
] as const;

export type TipoDePlanilha = (typeof TIPOS_DE_PLANILHA)[number];

export function tipoDePlanilhaValido(valor: unknown): valor is TipoDePlanilha {
  return (
    typeof valor === "string" && (TIPOS_DE_PLANILHA as readonly string[]).includes(valor)
  );
}

/** Como cada planilha aparece na tela "Minha conta". */
export const PLANILHAS: { tipo: TipoDePlanilha; rotulo: string; explicacao: string }[] = [
  {
    tipo: "clientes",
    rotulo: "Clientes",
    explicacao: "A ficha de cada pessoa, inclusive as arquivadas.",
  },
  {
    tipo: "atendimentos",
    rotulo: "Atendimentos",
    explicacao: "Todos os horários da agenda, com valor e situação.",
  },
  {
    tipo: "cobrancas",
    rotulo: "Cobranças",
    explicacao: "O que você cobrou dos clientes e o que já foi pago.",
  },
  {
    tipo: "lancamentos",
    rotulo: "Entradas e saídas",
    explicacao: "O dinheiro lançado fora da agenda, na aba Finanças.",
  },
  {
    tipo: "vencimentos",
    rotulo: "Vencimentos",
    explicacao: "Contas a pagar e prazos de contrato.",
  },
];

export type BancoDaPlanilha = Pick<
  PrismaClient,
  "cliente" | "agendamento" | "cobranca" | "lancamento" | "vencimento"
>;

type Planilha = { cabecalho: string[]; linhas: Celula[][] };

const simOuNao = (valor: boolean) => (valor ? "Sim" : "Não");

const ROTULO_DA_FORMA: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  outra: "Outra",
};

async function clientes(db: BancoDaPlanilha, usuarioId: string): Promise<Planilha> {
  const lista = await db.cliente.findMany({
    // Sem filtro de arquivadas: a cópia dos dados é completa.
    where: { usuarioId },
    orderBy: { nome: "asc" },
    select: {
      nome: true,
      telefone: true,
      email: true,
      cpf: true,
      endereco: true,
      nascimento: true,
      observacoes: true,
      semLembretes: true,
      arquivadoEm: true,
      criadoEm: true,
    },
  });

  return {
    cabecalho: [
      "Nome",
      "WhatsApp",
      "E-mail",
      "CPF",
      "Endereço",
      "Nascimento",
      "Observações",
      "Recebe lembretes",
      "Arquivada em",
      "Cadastrada em",
    ],
    linhas: lista.map((cliente) => [
      cliente.nome,
      cliente.telefone,
      cliente.email,
      cliente.cpf,
      cliente.endereco,
      dataCsv(cliente.nascimento),
      cliente.observacoes,
      simOuNao(!cliente.semLembretes),
      dataCsv(cliente.arquivadoEm),
      dataCsv(cliente.criadoEm),
    ]),
  };
}

async function atendimentos(db: BancoDaPlanilha, usuarioId: string): Promise<Planilha> {
  const lista = await db.agendamento.findMany({
    where: { usuarioId },
    orderBy: { inicio: "asc" },
    select: {
      inicio: true,
      status: true,
      valorCentavos: true,
      observacoes: true,
      confirmacaoEnviadaEm: true,
      cliente: { select: { nome: true } },
      servico: { select: { nome: true, precoCentavos: true } },
    },
  });

  return {
    cabecalho: [
      "Data",
      "Hora",
      "Cliente",
      "Serviço",
      "Valor",
      "Situação",
      "Confirmação enviada em",
      "Observações",
    ],
    linhas: lista.map((atendimento) => [
      dataCsv(atendimento.inicio),
      horaCsv(atendimento.inicio),
      atendimento.cliente.nome,
      atendimento.servico.nome,
      dinheiroCsv(valorDoAtendimento(atendimento)),
      situacaoValida(atendimento.status)
        ? ROTULO_DA_SITUACAO[atendimento.status]
        : atendimento.status,
      dataCsv(atendimento.confirmacaoEnviadaEm),
      atendimento.observacoes,
    ]),
  };
}

async function cobrancas(
  db: BancoDaPlanilha,
  usuarioId: string,
  agora: Date,
): Promise<Planilha> {
  const lista = await db.cobranca.findMany({
    where: { usuarioId },
    orderBy: { vencimento: "asc" },
    select: {
      valorCentavos: true,
      vencimento: true,
      situacao: true,
      formaDePagamento: true,
      pagaEm: true,
      criadoEm: true,
      cliente: { select: { nome: true } },
    },
  });
  const hoje = hojeNoEstudio(agora);

  return {
    cabecalho: [
      "Cliente",
      "Valor",
      "Vencimento",
      "Situação",
      "Forma de pagamento",
      "Paga em",
      "Criada em",
    ],
    linhas: lista.map((cobranca) => [
      cobranca.cliente.nome,
      dinheiroCsv(cobranca.valorCentavos),
      dataPuraCsv(cobranca.vencimento),
      ROTULO_DA_COBRANCA[situacaoDaCobranca(cobranca, hoje)],
      cobranca.formaDePagamento
        ? (ROTULO_DA_FORMA[cobranca.formaDePagamento] ?? cobranca.formaDePagamento)
        : "",
      dataPuraCsv(cobranca.pagaEm),
      dataCsv(cobranca.criadoEm),
    ]),
  };
}

async function lancamentos(db: BancoDaPlanilha, usuarioId: string): Promise<Planilha> {
  const lista = await db.lancamento.findMany({
    where: { usuarioId },
    orderBy: { data: "asc" },
    select: {
      data: true,
      tipo: true,
      descricao: true,
      categoria: true,
      valorCentavos: true,
    },
  });

  return {
    cabecalho: ["Data", "Tipo", "Descrição", "Categoria", "Valor"],
    linhas: lista.map((lancamento) => [
      dataCsv(lancamento.data),
      lancamento.tipo === "entrada" ? "Entrada" : "Saída",
      lancamento.descricao,
      lancamento.categoria,
      dinheiroCsv(lancamento.valorCentavos),
    ]),
  };
}

async function vencimentos(
  db: BancoDaPlanilha,
  usuarioId: string,
  agora: Date,
): Promise<Planilha> {
  const lista = await db.vencimento.findMany({
    where: { usuarioId },
    orderBy: { data: "asc" },
    select: {
      data: true,
      tipo: true,
      descricao: true,
      categoria: true,
      valorCentavos: true,
      pago: true,
      pagoEm: true,
    },
  });
  const hoje = hojeNoEstudio(agora);

  return {
    cabecalho: ["Data", "Tipo", "Descrição", "Categoria", "Valor", "Situação", "Pago em"],
    linhas: lista.map((vencimento) => [
      dataPuraCsv(vencimento.data),
      vencimento.tipo === "prazo" ? "Prazo de contrato" : "Conta",
      vencimento.descricao,
      vencimento.categoria,
      dinheiroCsv(vencimento.valorCentavos),
      ROTULO_DO_VENCIMENTO[situacaoDoVencimento(vencimento, hoje)],
      dataPuraCsv(vencimento.pagoEm),
    ]),
  };
}

/** A planilha pronta para baixar, já no formato que o Excel brasileiro abre. */
export async function planilhaEmCsv(
  db: BancoDaPlanilha,
  usuarioId: string,
  tipo: TipoDePlanilha,
  agora = new Date(),
) {
  const montada =
    tipo === "clientes"
      ? await clientes(db, usuarioId)
      : tipo === "atendimentos"
        ? await atendimentos(db, usuarioId)
        : tipo === "cobrancas"
          ? await cobrancas(db, usuarioId, agora)
          : tipo === "lancamentos"
            ? await lancamentos(db, usuarioId)
            : await vencimentos(db, usuarioId, agora);

  return montarCsv(montada.cabecalho, montada.linhas);
}
