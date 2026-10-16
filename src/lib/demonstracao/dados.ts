/**
 * Os dados do estúdio de exemplo, montados a partir de "agora".
 *
 * Tudo aqui é conta de datas e listas, sem banco: estudio.ts grava o que esta
 * função devolve, e os testes conferem a montagem sem precisar de Postgres.
 *
 * As datas são relativas ao dia de hoje em São Paulo, para a demonstração
 * sempre parecer viva: a agenda de hoje está cheia, há cobrança vencendo hoje e
 * atrasada, conta que vence amanhã e seis meses de movimento para os gráficos.
 * O sorteio usa uma semente fixa: para o mesmo dia, sai sempre o mesmo estúdio.
 *
 * Nomes, telefones, CNPJ e chave Pix são inventados. Os telefones seguem o
 * formato de celular para a tela funcionar, mas nenhuma mensagem sai da
 * demonstração: o botão do WhatsApp leva para a assinatura.
 */
import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma";
import {
  deDataPura,
  deHorarioLocal,
  paraDataLocal,
  paraDataPura,
  somarDiasPuros,
  somarMeses,
  competenciaAtual,
} from "@/lib/formato";
import {
  categoriaDoPagamento,
  descricaoDoLancamento,
  type TipoDePagamento,
} from "@/lib/equipe";
import { classificarPorRegra, motivoParaGravar, naturezaDoPagamentoDaEquipe } from "@/lib/custos/regras";
import { ocorrenciasQueFaltam } from "@/lib/vencimento";
import {
  EMAIL_DO_ESTUDIO_DE_EXEMPLO,
  ID_DO_ESTUDIO_DE_EXEMPLO,
  PAPEL_DA_DEMONSTRACAO,
} from "./conta";

/** O endereço da página pública de exemplo. Ela existe só para aparecer na tela. */
export const LINK_DO_EXEMPLO = "demonstracao-bossa";

const U = ID_DO_ESTUDIO_DE_EXEMPLO;

export type DadosDoExemplo = {
  usuario: Prisma.UsuarioCreateInput;
  clientes: Prisma.ClienteCreateManyInput[];
  servicos: Prisma.ServicoCreateManyInput[];
  colaboradores: Prisma.ColaboradorCreateManyInput[];
  ausencias: Prisma.AusenciaDoColaboradorCreateManyInput[];
  agendamentos: Prisma.AgendamentoCreateManyInput[];
  lancamentos: Prisma.LancamentoCreateManyInput[];
  pagamentosDaEquipe: Prisma.PagamentoDeColaboradorCreateManyInput[];
  cobrancas: Prisma.CobrancaCreateManyInput[];
  lembretes: Prisma.LembreteDeCobrancaCreateManyInput[];
  repeticoes: Prisma.RepeticaoDeVencimentoCreateManyInput[];
  vencimentos: Prisma.VencimentoCreateManyInput[];
  documentos: Prisma.DocumentoCreateManyInput[];
  itensDosDocumentos: Prisma.ItemDoDocumentoCreateManyInput[];
  conversas: Prisma.ConversaDeIaCreateManyInput[];
  mensagens: Prisma.MensagemDeIaCreateManyInput[];
  usosDeIa: Prisma.UsoDeIaCreateManyInput[];
  agendaOnline: Prisma.AgendaOnlineCreateManyInput;
  faixas: Prisma.FaixaDeAtendimentoCreateManyInput[];
  acessoDoContador: Prisma.AcessoDoContadorCreateManyInput;
  /** O mês anterior, que aparece fechado no Relatório. */
  mesFechado: { competencia: string; fechadoEm: Date };
};

/* ------------------------------------------------------------ sorteio */

/** Mulberry32: pequeno, rápido e sempre igual para a mesma semente. */
function sorteador(semente: number) {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* -------------------------------------------------------------- datas */

/** "AAAA-MM-DD" somado de n dias. */
function diaMais(dia: string, n: number) {
  return paraDataPura(somarDiasPuros(deDataPura(dia)!, n));
}

/** O instante "AAAA-MM-DD" às "HH:MM" em São Paulo. */
function instante(dia: string, horario: string) {
  return deHorarioLocal(`${dia}T${horario}`)!;
}

/** 0 = domingo ... 6 = sábado, do dia de calendário. */
function diaDaSemana(dia: string) {
  return new Date(`${dia}T12:00:00.000Z`).getUTCDay();
}

/** O dia `n` do mês "AAAA-MM", limitado ao último dia do mês. */
function diaDoMes(mes: string, n: number) {
  const [ano, m] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(ano, m, 0)).getUTCDate();
  return `${mes}-${String(Math.min(n, ultimo)).padStart(2, "0")}`;
}

function minutos(horario: string) {
  const [h, m] = horario.split(":").map(Number);
  return h * 60 + m;
}

/* ------------------------------------------------------------ cadastro */

const CLIENTES = [
  { nome: "Mariana Souza", telefone: "19990012841", observacoes: "Prefere horários no fim da tarde." },
  { nome: "Fernanda Oliveira", telefone: "19990023517" },
  { nome: "Patrícia Lima", telefone: "19990034962", observacoes: "Alergia a amônia: usar coloração sem amônia." },
  { nome: "Camila Rocha", telefone: "19990045380" },
  { nome: "Beatriz Santos", telefone: "19990056214" },
  { nome: "Renata Carvalho", telefone: "19990067723", observacoes: "Gosta de café sem açúcar." },
  { nome: "Luciana Ferreira", telefone: "19990078145" },
  { nome: "Aline Costa", telefone: "19990089406" },
  { nome: "Tatiane Ribeiro", telefone: "19990090671" },
  { nome: "Débora Martins", telefone: "19990101358" },
  { nome: "Gabriela Nunes", telefone: "19990112984" },
  { nome: "Vanessa Almeida", telefone: "19990123407" },
  { nome: "Roberto Dias", telefone: "19990134652" },
  { nome: "Larissa Teixeira", telefone: "19990145239" },
  { nome: "Juliana Moreira", telefone: "19990156810" },
  { nome: "Sandra Pires", telefone: "19990167095" },
];

type Quem = "dona" | "paula" | "kelly";

const SERVICOS: {
  chave: string;
  nome: string;
  precoCentavos: number;
  duracaoMin: number;
  descricao?: string;
  agendavelOnline?: boolean;
  /** Quem costuma atender, e o peso no sorteio. */
  quem: Quem[];
  peso: number;
}[] = [
  { chave: "corte", nome: "Corte feminino", precoCentavos: 9000, duracaoMin: 60, quem: ["paula", "dona"], peso: 5 },
  { chave: "escova", nome: "Escova modelada", precoCentavos: 6000, duracaoMin: 45, quem: ["paula", "dona"], peso: 4 },
  {
    chave: "coloracao",
    nome: "Coloração",
    precoCentavos: 22000,
    duracaoMin: 120,
    descricao: "Raiz e comprimento, com produto sem amônia se precisar.",
    quem: ["paula"],
    peso: 2,
  },
  { chave: "hidratacao", nome: "Hidratação", precoCentavos: 11000, duracaoMin: 60, quem: ["paula", "dona"], peso: 2 },
  { chave: "manicure", nome: "Manicure e pedicure", precoCentavos: 7000, duracaoMin: 60, quem: ["kelly"], peso: 5 },
  { chave: "sobrancelha", nome: "Design de sobrancelha", precoCentavos: 4500, duracaoMin: 30, quem: ["dona"], peso: 3 },
  {
    chave: "limpeza",
    nome: "Limpeza de pele",
    precoCentavos: 16000,
    duracaoMin: 90,
    descricao: "Higienização, extração e máscara calmante.",
    agendavelOnline: false,
    quem: ["dona"],
    peso: 1,
  },
];

const HORARIOS = ["09:00", "10:00", "11:00", "13:30", "14:30", "15:30", "16:30", "17:30"];

/* ------------------------------------------------------------- montagem */

export function montarEstudioDeExemplo(agora: Date): DadosDoExemplo {
  const sorteio = sorteador(20261016);
  const escolher = <T>(lista: T[]) => lista[Math.floor(sorteio() * lista.length)];

  const hoje = paraDataLocal(agora);
  const mesAtual = competenciaAtual(agora);
  const mesAnterior = somarMeses(mesAtual, -1);
  const primeiroMes = somarMeses(mesAtual, -5);
  const inicioDoHistorico = `${primeiroMes}-01`;
  const fimDaAgenda = diaMais(hoje, 13);
  const ehPassado = (quando: Date) => quando.getTime() < agora.getTime();

  /* ---------------------------------------------------------- cadastro */

  const desdeDoEstudio = instante(diaMais(inicioDoHistorico, -400), "10:00");

  const clientes: Prisma.ClienteCreateManyInput[] = CLIENTES.map((cliente, i) => ({
    id: `exemplo-cliente-${i + 1}`,
    usuarioId: U,
    nome: cliente.nome,
    telefone: cliente.telefone,
    observacoes: cliente.observacoes ?? null,
    criadoEm: instante(diaMais(inicioDoHistorico, -200 + i * 13), "10:00"),
  }));

  const servicos: Prisma.ServicoCreateManyInput[] = SERVICOS.map((servico) => ({
    id: `exemplo-servico-${servico.chave}`,
    usuarioId: U,
    nome: servico.nome,
    precoCentavos: servico.precoCentavos,
    duracaoMin: servico.duracaoMin,
    descricao: servico.descricao ?? null,
    agendavelOnline: servico.agendavelOnline ?? true,
    criadoEm: desdeDoEstudio,
  }));

  const ID_DE: Record<Exclude<Quem, "dona">, string> = {
    paula: "exemplo-colaborador-paula",
    kelly: "exemplo-colaborador-kelly",
  };
  const ID_SIMONE = "exemplo-colaborador-simone";

  const colaboradores: Prisma.ColaboradorCreateManyInput[] = [
    {
      id: ID_DE.paula,
      usuarioId: U,
      nome: "Paula Andrade",
      cargo: "Cabeleireira",
      vinculo: "parceria",
      inicio: deDataPura(diaMais(inicioDoHistorico, -380))!,
      comissaoPontosBase: 5000,
      telefone: "19990178422",
    },
    {
      id: ID_DE.kelly,
      usuarioId: U,
      nome: "Kelly Moraes",
      cargo: "Manicure",
      vinculo: "mei",
      inicio: deDataPura(diaMais(inicioDoHistorico, -150))!,
      porAtendimentoCentavos: 3500,
      telefone: "19990189530",
    },
    {
      id: ID_SIMONE,
      usuarioId: U,
      nome: "Simone Barros",
      cargo: "Recepcionista",
      vinculo: "clt",
      inicio: deDataPura(diaMais(inicioDoHistorico, -300))!,
      salarioCentavos: 180000,
      telefone: "19990190648",
    },
  ];

  const ausencias: Prisma.AusenciaDoColaboradorCreateManyInput[] = [
    {
      id: "exemplo-ausencia-kelly",
      usuarioId: U,
      colaboradorId: ID_DE.kelly,
      tipo: "indisponivel",
      inicio: deDataPura(diaMais(hoje, 9))!,
      fim: deDataPura(diaMais(hoje, 10))!,
    },
    {
      id: "exemplo-ausencia-simone",
      usuarioId: U,
      colaboradorId: ID_SIMONE,
      tipo: "ferias",
      inicio: deDataPura(diaMais(hoje, 25))!,
      fim: deDataPura(diaMais(hoje, 39))!,
    },
  ];

  /* ------------------------------------------------------------ agenda */

  const sorteioDePeso = SERVICOS.flatMap((servico) => Array(servico.peso).fill(servico) as typeof SERVICOS);
  const agendamentos: Prisma.AgendamentoCreateManyInput[] = [];
  /**
   * O que cada profissional atendeu no mês: base dos pagamentos da equipe. Paula
   * recebe a cota-parte sobre o valor; Kelly, um valor por atendimento.
   */
  const producaoDoMes = new Map<string, { paulaCentavos: number; kellyAtendimentos: number }>();
  // Os dias em que Kelly avisou que não atende (ver ausências).
  const kellyFora = new Set([diaMais(hoje, 9), diaMais(hoje, 10)]);

  let numero = 0;
  for (let dia = inicioDoHistorico; dia <= fimDaAgenda; dia = diaMais(dia, 1)) {
    const ehHoje = dia === hoje;
    // Domingo fechado. Hoje sempre tem agenda, para a demonstração não abrir vazia.
    if (diaDaSemana(dia) === 0 && !ehHoje) continue;

    const distancia = Math.round(
      (deDataPura(dia)!.getTime() - deDataPura(hoje)!.getTime()) / 86_400_000,
    );
    // Passado cheio, futuro enchendo aos poucos, como numa agenda de verdade.
    const quantos = ehHoje
      ? 7
      : distancia < 0
        ? 4 + Math.floor(sorteio() * 3)
        : Math.max(1, 6 - Math.floor(distancia / 2) - Math.floor(sorteio() * 2));

    const livres = [...HORARIOS];
    const ocupadoAte: Record<Quem, number> = { dona: 0, paula: 0, kelly: 0 };
    const doDia: string[] = [];
    const clientesDoDia = new Set<string>();
    while (doDia.length < quantos && livres.length > 0) {
      doDia.push(livres.splice(Math.floor(sorteio() * livres.length), 1)[0]);
    }
    doDia.sort();

    for (const horario of doDia) {
      const servico = escolher(sorteioDePeso);
      const comeca = minutos(horario);
      const quem = servico.quem.find(
        (pessoa) => ocupadoAte[pessoa] <= comeca && !(pessoa === "kelly" && kellyFora.has(dia)),
      );
      if (!quem) continue; // Ninguém livre: o horário fica vago, sem horário batendo.
      ocupadoAte[quem] = comeca + servico.duracaoMin;

      numero += 1;
      const inicio = instante(dia, horario);
      const passado = ehPassado(inicio);
      const cancelado = passado && sorteio() < 0.04;
      const status = cancelado ? "cancelado" : passado ? "concluido" : "agendado";
      // A mesma cliente não aparece duas vezes no mesmo dia.
      const livresNoDia = clientes.filter((item) => !clientesDoDia.has(item.id!));
      const cliente = livresNoDia[Math.floor(sorteio() * livresNoDia.length)] ?? clientes[0];
      clientesDoDia.add(cliente.id!);

      // Alguns horários futuros chegaram pelo link nos últimos dias.
      const peloLink = !passado && sorteio() < 0.18;
      const marcadoEm = peloLink
        ? new Date(agora.getTime() - Math.floor(sorteio() * 3 * 86_400_000) - 3_600_000)
        : new Date(inicio.getTime() - (2 + Math.floor(sorteio() * 10)) * 86_400_000);

      agendamentos.push({
        id: `exemplo-horario-${numero}`,
        usuarioId: U,
        clienteId: cliente.id!,
        servicoId: `exemplo-servico-${servico.chave}`,
        inicio,
        status,
        colaboradorId: quem === "dona" ? null : ID_DE[quem],
        origem: peloLink ? "link" : null,
        // Os mais antigos já foram vistos; os de ontem e de hoje aparecem como novidade no Início.
        vistoEm: peloLink && agora.getTime() - marcadoEm.getTime() > 36 * 3_600_000 ? agora : null,
        criadoEm: marcadoEm.getTime() < agora.getTime() ? marcadoEm : agora,
      });

      if (status === "concluido" && quem !== "dona") {
        const mes = dia.slice(0, 7);
        const producao = producaoDoMes.get(mes) ?? { paulaCentavos: 0, kellyAtendimentos: 0 };
        if (quem === "paula") producao.paulaCentavos += servico.precoCentavos;
        else producao.kellyAtendimentos += 1;
        producaoDoMes.set(mes, producao);
      }
    }
  }

  /* -------------------------------------------------------- lançamentos */

  const lancamentos: Prisma.LancamentoCreateManyInput[] = [];
  const pagamentosDaEquipe: Prisma.PagamentoDeColaboradorCreateManyInput[] = [];
  const idDoAluguel = new Map<string, string>();

  function lancar(
    id: string,
    tipo: "entrada" | "saida",
    descricao: string,
    categoria: string,
    valorCentavos: number,
    dia: string,
    classificacao?: { natureza: string; origem: "regra" | "ia" | "voce"; motivo?: string } | "regra" | null,
  ) {
    if (dia > hoje) return false;
    let natureza: string | null = null;
    let naturezaOrigem: string | null = null;
    let naturezaMotivo: string | null = null;
    if (tipo === "saida" && classificacao === "regra") {
      const regra = classificarPorRegra({ descricao, categoria });
      if (regra) {
        natureza = regra.natureza;
        naturezaOrigem = "regra";
        naturezaMotivo = motivoParaGravar(regra.motivo);
      }
    } else if (tipo === "saida" && typeof classificacao === "object" && classificacao) {
      natureza = classificacao.natureza;
      naturezaOrigem = classificacao.origem;
      naturezaMotivo = classificacao.motivo ? motivoParaGravar(classificacao.motivo) : null;
    }
    lancamentos.push({
      id,
      usuarioId: U,
      tipo,
      descricao,
      categoria,
      valorCentavos,
      data: instante(dia, "10:00"),
      natureza,
      naturezaOrigem,
      naturezaMotivo,
      criadoEm: instante(dia, "10:00"),
    });
    return true;
  }

  function pagarEquipe(
    id: string,
    colaboradorId: string,
    nome: string,
    tipo: TipoDePagamento,
    competencia: string,
    valorCentavos: number,
    dia: string,
  ) {
    if (valorCentavos <= 0 || dia > hoje) return;
    const natureza = naturezaDoPagamentoDaEquipe(tipo);
    lancar(
      `${id}-saida`,
      "saida",
      descricaoDoLancamento(tipo, nome),
      categoriaDoPagamento(tipo),
      valorCentavos,
      dia,
      natureza ? { natureza: natureza.natureza, origem: "regra", motivo: natureza.motivo } : null,
    );
    pagamentosDaEquipe.push({
      id,
      usuarioId: U,
      colaboradorId,
      tipo,
      competencia,
      valorCentavos,
      pagoEm: deDataPura(dia)!,
      lancamentoId: `${id}-saida`,
    });
  }

  for (let passo = 0; passo < 6; passo++) {
    const mes = somarMeses(primeiroMes, passo);
    const variacao = () => 0.85 + sorteio() * 0.3;

    if (lancar(`exemplo-aluguel-${mes}`, "saida", "Aluguel do salão", "Aluguel", 280000, diaDoMes(mes, 5), "regra")) {
      idDoAluguel.set(mes, `exemplo-aluguel-${mes}`);
    }
    lancar(`exemplo-luz-${mes}`, "saida", "Conta de energia", "Contas da casa", Math.round(41000 * variacao()), diaDoMes(mes, 12), "regra");
    lancar(`exemplo-agua-${mes}`, "saida", "Conta de água", "Contas da casa", Math.round(9800 * variacao()), diaDoMes(mes, 14), "regra");
    lancar(`exemplo-internet-${mes}`, "saida", "Internet fibra", "Contas da casa", 11990, diaDoMes(mes, 10), "regra");
    lancar(`exemplo-contador-${mes}`, "saida", "Honorários do escritório de contabilidade", "Serviços", 35000, diaDoMes(mes, 8), {
      natureza: "fixo",
      origem: "ia",
      motivo: "Honorário mensal combinado com o escritório, pago todo mês.",
    });
    lancar(`exemplo-produtos-${mes}`, "saida", "Produtos de coloração e tratamento", "Produtos", Math.round(78000 * variacao()), diaDoMes(mes, 16), "regra");
    lancar(`exemplo-descartaveis-${mes}`, "saida", "Material descartável", "Produtos", Math.round(14500 * variacao()), diaDoMes(mes, 20), "regra");
    lancar(`exemplo-maquininha-${mes}`, "saida", "Taxa da maquininha de cartão", "Taxas", Math.round(23000 * variacao()), diaDoMes(mes, 28), "regra");
    lancar(`exemplo-das-${mes}`, "saida", "DAS do Simples Nacional", "Impostos", Math.round(98000 * variacao()), diaDoMes(mes, 20), "regra");
    lancar(`exemplo-revenda-${mes}`, "entrada", "Venda de produtos no balcão", "Vendas", Math.round(32000 * variacao()), diaDoMes(mes, 18));
    if (passo % 2 === 0) {
      lancar(`exemplo-presente-${mes}`, "entrada", "Vale-presente", "Vendas", 15000, diaDoMes(mes, 9));
    }
    if (passo === 2) {
      lancar(`exemplo-juros-${mes}`, "saida", "Juros do cartão da empresa", "Banco", 4890, diaDoMes(mes, 22), {
        natureza: "nao_operacional",
        origem: "voce",
      });
    }

    // A equipe é paga no dia 5 pelo trabalho do mês anterior.
    const mesDoTrabalho = somarMeses(mes, -1);
    // O primeiro mês do histórico não tem o anterior gerado: paga uma estimativa redonda.
    const producao = producaoDoMes.get(mesDoTrabalho) ?? { paulaCentavos: 640000, kellyAtendimentos: 38 };
    pagarEquipe(`exemplo-pagamento-paula-${mes}`, ID_DE.paula, "Paula Andrade", "cota_parte", mesDoTrabalho, Math.round(producao.paulaCentavos / 2), diaDoMes(mes, 5));
    pagarEquipe(`exemplo-pagamento-kelly-${mes}`, ID_DE.kelly, "Kelly Moraes", "repasse", mesDoTrabalho, producao.kellyAtendimentos * 3500, diaDoMes(mes, 5));
    pagarEquipe(`exemplo-pagamento-simone-${mes}`, ID_SIMONE, "Simone Barros", "salario", mesDoTrabalho, 165600, diaDoMes(mes, 5));
  }

  // Duas despesas do mês ainda sem classificação, para a tela de Custos ter o que mostrar.
  lancar("exemplo-sem-classe-1", "saida", "Conserto da cadeira do lavatório", "Manutenção", 18000, diaMais(hoje, -2) >= `${mesAtual}-01` ? diaMais(hoje, -2) : hoje);
  lancar("exemplo-sem-classe-2", "saida", "Lanche da equipe no sábado", "Outros", 6400, diaMais(hoje, -1) >= `${mesAtual}-01` ? diaMais(hoje, -1) : hoje);

  /* ---------------------------------------------------------- cobranças */

  const cobrancas: Prisma.CobrancaCreateManyInput[] = [];
  const lembretes: Prisma.LembreteDeCobrancaCreateManyInput[] = [];
  const concluidos = agendamentos.filter((item) => item.status === "concluido");
  const usados = new Set<string>();
  const precoDe = new Map(servicos.map((servico) => [servico.id!, servico.precoCentavos]));

  /** O atendimento concluído mais perto de `dia`, ainda sem cobrança. */
  function atendimentoPerto(dia: string) {
    const alvo = instante(dia, "12:00").getTime();
    let melhor: Prisma.AgendamentoCreateManyInput | null = null;
    for (const item of concluidos) {
      if (usados.has(item.id!)) continue;
      const inicio = (item.inicio as Date).getTime();
      if (inicio > alvo) continue;
      if (!melhor || inicio > (melhor.inicio as Date).getTime()) melhor = item;
    }
    if (melhor) usados.add(melhor.id!);
    return melhor;
  }

  const planoDasCobrancas: {
    chave: string;
    atendidoHa: number;
    vence: number;
    situacao: "aberta" | "paga" | "cancelada";
    pagaHa?: number;
    forma?: string;
    lembretes?: string[];
  }[] = [
    { chave: "hoje-1", atendidoHa: 0, vence: 0, situacao: "aberta" },
    { chave: "hoje-2", atendidoHa: 7, vence: 0, situacao: "aberta", lembretes: ["antes"] },
    { chave: "amanha", atendidoHa: 2, vence: 1, situacao: "aberta" },
    { chave: "depois", atendidoHa: 1, vence: 5, situacao: "aberta" },
    { chave: "atraso-3", atendidoHa: 10, vence: -3, situacao: "aberta", lembretes: ["antes", "no_dia"] },
    { chave: "atraso-8", atendidoHa: 15, vence: -8, situacao: "aberta", lembretes: ["no_dia", "tres_dias"] },
    { chave: "atraso-16", atendidoHa: 24, vence: -16, situacao: "aberta", lembretes: ["no_dia", "tres_dias", "sete_dias"] },
    { chave: "paga-1", atendidoHa: 6, vence: -2, situacao: "paga", pagaHa: 2, forma: "pix" },
    { chave: "paga-2", atendidoHa: 12, vence: -9, situacao: "paga", pagaHa: 8, forma: "pix" },
    { chave: "paga-3", atendidoHa: 20, vence: -15, situacao: "paga", pagaHa: 15, forma: "dinheiro" },
    { chave: "paga-4", atendidoHa: 33, vence: -28, situacao: "paga", pagaHa: 26, forma: "cartao" },
    { chave: "cancelada", atendidoHa: 18, vence: -11, situacao: "cancelada" },
  ];

  for (const plano of planoDasCobrancas) {
    const atendimento = atendimentoPerto(diaMais(hoje, -plano.atendidoHa));
    if (!atendimento) continue;
    const id = `exemplo-cobranca-${plano.chave}`;
    const criadoEm = new Date(Math.min((atendimento.inicio as Date).getTime() + 2 * 3_600_000, agora.getTime()));
    cobrancas.push({
      id,
      usuarioId: U,
      clienteId: atendimento.clienteId,
      agendamentoId: atendimento.id!,
      valorCentavos: precoDe.get(atendimento.servicoId) ?? 10000,
      vencimento: deDataPura(diaMais(hoje, plano.vence))!,
      situacao: plano.situacao,
      formaDePagamento: plano.forma ?? null,
      pagaEm: plano.pagaHa !== undefined ? deDataPura(diaMais(hoje, -plano.pagaHa))! : null,
      criadoEm,
    });
    for (const momento of plano.lembretes ?? []) {
      const dias = { antes: -1, no_dia: 0, tres_dias: 3, sete_dias: 7 }[momento] ?? 0;
      lembretes.push({
        id: `${id}-lembrete-${momento}`,
        cobrancaId: id,
        momento,
        enviadoEm: instante(diaMais(hoje, plano.vence + dias), "09:40"),
      });
    }
  }

  /* -------------------------------------------------------- vencimentos */

  const repeticoes: Prisma.RepeticaoDeVencimentoCreateManyInput[] = [
    {
      id: "exemplo-repeticao-aluguel",
      usuarioId: U,
      tipo: "conta",
      descricao: "Aluguel do salão",
      categoria: "Aluguel",
      valorCentavos: 280000,
      primeira: deDataPura(diaDoMes(primeiroMes, 5))!,
      criadoEm: desdeDoEstudio,
    },
  ];

  const vencimentos: Prisma.VencimentoCreateManyInput[] = [];
  // O aluguel dos meses que passaram já foi pago, e a saída é o lançamento do mês.
  for (const [mes, lancamentoId] of idDoAluguel) {
    vencimentos.push({
      id: `exemplo-vencimento-aluguel-${mes}`,
      usuarioId: U,
      tipo: "conta",
      descricao: "Aluguel do salão",
      categoria: "Aluguel",
      valorCentavos: 280000,
      data: deDataPura(diaDoMes(mes, 5))!,
      pago: true,
      pagoEm: deDataPura(diaDoMes(mes, 5))!,
      lancamentoId,
      repeticaoId: "exemplo-repeticao-aluguel",
    });
  }
  // Os próximos doze, do mesmo jeito que a tela completaria sozinha.
  const jaGravadas = vencimentos.map((item) => item.data as Date);
  for (const data of ocorrenciasQueFaltam({
    primeira: deDataPura(diaDoMes(primeiroMes, 5))!,
    jaGravadas,
    hoje: deDataPura(hoje)!,
  })) {
    vencimentos.push({
      id: `exemplo-vencimento-aluguel-${paraDataPura(data)}`,
      usuarioId: U,
      tipo: "conta",
      descricao: "Aluguel do salão",
      categoria: "Aluguel",
      valorCentavos: 280000,
      data,
      repeticaoId: "exemplo-repeticao-aluguel",
    });
  }

  const avulsos: { chave: string; tipo: "conta" | "prazo"; descricao: string; categoria?: string; valor?: number; dias: number }[] = [
    { chave: "fornecedor", tipo: "conta", descricao: "Boleto do fornecedor de cosméticos", categoria: "Produtos", valor: 86000, dias: -2 },
    { chave: "energia", tipo: "conta", descricao: "Conta de energia", categoria: "Contas da casa", valor: 41280, dias: 1 },
    { chave: "internet", tipo: "conta", descricao: "Internet fibra", categoria: "Contas da casa", valor: 11990, dias: 3 },
    { chave: "das", tipo: "conta", descricao: "DAS do Simples Nacional", categoria: "Impostos", valor: 113740, dias: 6 },
    { chave: "seguro", tipo: "conta", descricao: "Seguro do salão (parcela 4 de 10)", categoria: "Seguros", valor: 18900, dias: 12 },
    { chave: "reajuste", tipo: "prazo", descricao: "Reajuste do aluguel pelo IGP-M", dias: 48 },
    { chave: "fim-contrato", tipo: "prazo", descricao: "Fim do contrato de locação do salão", dias: 230 },
  ];
  for (const item of avulsos) {
    vencimentos.push({
      id: `exemplo-vencimento-${item.chave}`,
      usuarioId: U,
      tipo: item.tipo,
      descricao: item.descricao,
      categoria: item.categoria ?? null,
      valorCentavos: item.valor ?? null,
      data: deDataPura(diaMais(hoje, item.dias))!,
    });
  }

  /* --------------------------------------------------------- documentos */

  const fimDoContrato = deDataPura(diaMais(hoje, 230))!;
  const reajuste = deDataPura(diaMais(hoje, 48))!;
  const documentos: Prisma.DocumentoCreateManyInput[] = [
    {
      id: "exemplo-documento-contrato",
      usuarioId: U,
      nome: "Contrato de locação do salão.pdf",
      caminho: "exemplo/contrato-de-locacao.pdf",
      tipoDoArquivo: "application/pdf",
      tamanhoBytes: 482_113,
      paginas: 6,
      situacao: "pronto",
      tipoDeDocumento: "Contrato de locação comercial",
      partes: "Imobiliária Horizonte Ltda. e Studio Ipê Beleza",
      resumo:
        "Locação da sala comercial do salão por 30 meses, com aluguel de R$ 2.800,00 todo dia 5, reajuste anual pelo IGP-M e IPTU dividido em parcelas pagas junto com o aluguel.",
      fimDoContrato,
      reajusteEm: reajuste,
      indiceDeReajuste: "IGP-M",
      multa: "Três aluguéis, proporcional ao tempo que faltar",
      avisoPrevio: "30 dias, por escrito",
      leituraEm: new Date(agora.getTime() - 26 * 3_600_000),
      criadoEm: new Date(agora.getTime() - 26 * 3_600_000),
    },
    {
      id: "exemplo-documento-energia",
      usuarioId: U,
      nome: "Conta de energia.jpg",
      caminho: "exemplo/conta-de-energia.jpg",
      tipoDoArquivo: "image/jpeg",
      tamanhoBytes: 1_204_550,
      paginas: 1,
      situacao: "conferido",
      tipoDeDocumento: "Conta de energia elétrica",
      resumo: "Conta de energia do salão, com vencimento amanhã.",
      leituraEm: new Date(agora.getTime() - 4 * 86_400_000),
      criadoEm: new Date(agora.getTime() - 4 * 86_400_000),
    },
  ];

  const itensDosDocumentos: Prisma.ItemDoDocumentoCreateManyInput[] = [
    {
      id: "exemplo-item-aluguel",
      documentoId: "exemplo-documento-contrato",
      descricao: "Aluguel mensal da sala",
      tipo: "saida",
      valorCentavos: 280000,
      data: deDataPura(diaDoMes(somarMeses(mesAtual, 1), 5))!,
      repeticao: "mensal",
      repeteAte: fimDoContrato,
      trecho: "O LOCATÁRIO pagará o aluguel mensal de R$ 2.800,00 (dois mil e oitocentos reais) até o dia 5 de cada mês.",
      pagina: 2,
    },
    {
      id: "exemplo-item-iptu",
      documentoId: "exemplo-documento-contrato",
      descricao: "Parcela do IPTU",
      tipo: "saida",
      valorCentavos: 18450,
      data: deDataPura(diaDoMes(somarMeses(mesAtual, 1), 5))!,
      repeticao: "mensal",
      trecho: "O IPTU será pago pelo LOCATÁRIO em parcelas mensais, junto com o aluguel.",
      pagina: 3,
      duvidoso: true,
    },
    {
      id: "exemplo-item-reajuste",
      documentoId: "exemplo-documento-contrato",
      descricao: "Reajuste anual do aluguel (IGP-M)",
      tipo: "saida",
      data: reajuste,
      trecho: "O aluguel será reajustado a cada 12 meses pela variação do IGP-M/FGV.",
      pagina: 2,
    },
    {
      id: "exemplo-item-energia",
      documentoId: "exemplo-documento-energia",
      descricao: "Conta de energia",
      tipo: "saida",
      valorCentavos: 41280,
      data: deDataPura(diaMais(hoje, 1))!,
      trecho: "TOTAL A PAGAR R$ 412,80 — VENCIMENTO",
      pagina: 1,
      decisao: "aceito",
      vencimentoId: "exemplo-vencimento-energia",
    },
  ];

  /* ---------------------------------------------------------- assistente */

  const receitaDoMesAnterior =
    concluidos
      .filter((item) => competenciaAtual(item.inicio as Date) === mesAnterior)
      .reduce((soma, item) => soma + (precoDe.get(item.servicoId) ?? 0), 0) +
    lancamentos
      .filter((item) => item.tipo === "entrada" && competenciaAtual(item.data as Date) === mesAnterior)
      .reduce((soma, item) => soma + item.valorCentavos, 0);
  const despesaDoMesAnterior = lancamentos
    .filter((item) => item.tipo === "saida" && competenciaAtual(item.data as Date) === mesAnterior)
    .reduce((soma, item) => soma + item.valorCentavos, 0);
  const atendimentosDoMesAnterior = concluidos.filter(
    (item) => competenciaAtual(item.inicio as Date) === mesAnterior,
  ).length;

  const porDiaDaSemana = [0, 0, 0, 0, 0, 0, 0];
  for (const item of concluidos) porDiaDaSemana[diaDaSemana(paraDataLocal(item.inicio as Date))] += 1;
  const NOMES = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  const abertos = [1, 2, 3, 4, 5, 6];
  const maisVazio = abertos.reduce((a, b) => (porDiaDaSemana[b] < porDiaDaSemana[a] ? b : a));
  const maisCheio = abertos.reduce((a, b) => (porDiaDaSemana[b] > porDiaDaSemana[a] ? b : a));

  const reais = (centavos: number) =>
    (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const conversaUm = {
    pergunta: "Como foi meu último mês?",
    resposta: [
      `No mês passado o estúdio faturou **${reais(receitaDoMesAnterior)}**, com ${atendimentosDoMesAnterior} atendimentos concluídos e as vendas no balcão.`,
      "",
      `As saídas somaram **${reais(despesaDoMesAnterior)}**, então sobraram **${reais(receitaDoMesAnterior - despesaDoMesAnterior)}** antes do seu pró-labore.`,
      "",
      "Três sugestões:",
      "- O aluguel é o maior custo fixo. Vale olhar a data do reajuste pelo IGP-M em Vencimentos e conversar com a imobiliária antes dela.",
      "- Coloração é o serviço que mais traz por horário. Um pacote com hidratação pode aumentar o valor de cada visita.",
      "- Há cobranças atrasadas em Cobranças: um lembrete gentil hoje costuma resolver.",
      "",
      "Fonte: Finanças, Agenda e Cobranças do Bossa.",
    ].join("\n"),
  };
  const conversaDois = {
    pergunta: "Em que dia a agenda fica mais vazia?",
    resposta: [
      `Nos últimos seis meses, **${NOMES[maisVazio]}** foi o dia com menos atendimentos concluídos (${porDiaDaSemana[maisVazio]}), e **${NOMES[maisCheio]}** o mais cheio (${porDiaDaSemana[maisCheio]}).`,
      "",
      `Uma ideia: oferecer um valor especial de escova ou hidratação na ${NOMES[maisVazio]}, divulgado pelo seu link de agendamento.`,
    ].join("\n"),
  };

  const conversas: Prisma.ConversaDeIaCreateManyInput[] = [];
  const mensagens: Prisma.MensagemDeIaCreateManyInput[] = [];
  [conversaDois, conversaUm].forEach((conversa, i) => {
    // Só letras e números: a tela do assistente recusa id em outro formato.
    const id = `exemploconversa${i + 1}`;
    const quando = new Date(agora.getTime() - (i === 0 ? 3 : 1) * 86_400_000);
    conversas.push({
      id,
      usuarioId: U,
      titulo: conversa.pergunta,
      sistema: "Conversa de exemplo da demonstração do Bossa.",
      ferramentas: "[]",
      criadoEm: quando,
      atualizadoEm: quando,
    });
    mensagens.push(
      {
        id: `${id}-pergunta`,
        usuarioId: U,
        conversaId: id,
        ordem: 0,
        papel: "user",
        conteudo: JSON.stringify([{ type: "text", text: conversa.pergunta }]),
        textoNaTela: conversa.pergunta,
        situacao: "concluida",
        chamadas: 1,
        criadoEm: quando,
      },
      {
        id: `${id}-resposta`,
        usuarioId: U,
        conversaId: id,
        ordem: 1,
        papel: "assistant",
        conteudo: JSON.stringify([{ type: "text", text: conversa.resposta }]),
        textoNaTela: conversa.resposta,
        motivoParada: "end_turn",
        criadoEm: quando,
      },
    );
  });

  const comecoDoMes = instante(`${mesAtual}-01`, "09:00");
  const noMes = (horas: number) => new Date(Math.min(comecoDoMes.getTime() + horas * 3_600_000, agora.getTime()));
  const usosDeIa: Prisma.UsoDeIaCreateManyInput[] = [
    { id: "exemplo-uso-1", usuarioId: U, recurso: "assistente", unidades: 1, criadoEm: noMes(30) },
    { id: "exemplo-uso-2", usuarioId: U, recurso: "assistente", unidades: 1, criadoEm: noMes(60) },
    { id: "exemplo-uso-3", usuarioId: U, recurso: "classificacao", unidades: 12, criadoEm: noMes(40) },
    { id: "exemplo-uso-4", usuarioId: U, recurso: "leitura", unidades: 1, criadoEm: noMes(50) },
  ];

  /* ---------------------------------------------------- agendamento online */

  const agendaOnline: Prisma.AgendaOnlineCreateManyInput = {
    id: "exemplo-agenda-online",
    usuarioId: U,
    link: LINK_DO_EXEMPLO,
    ativa: true,
    antecedenciaMin: 120,
    diasAFrente: 30,
    escolherQuemAtende: true,
    donaAtende: true,
  };
  const faixas: Prisma.FaixaDeAtendimentoCreateManyInput[] = [];
  for (const dia of [1, 2, 3, 4, 5]) {
    if (dia > 1) faixas.push({ id: `exemplo-faixa-${dia}-manha`, usuarioId: U, diaDaSemana: dia, inicioMin: 540, fimMin: 720 });
    faixas.push({ id: `exemplo-faixa-${dia}-tarde`, usuarioId: U, diaDaSemana: dia, inicioMin: 810, fimMin: 1140 });
  }
  faixas.push({ id: "exemplo-faixa-6", usuarioId: U, diaDaSemana: 6, inicioMin: 480, fimMin: 840 });

  /* ------------------------------------------------------------ contador */

  // Ninguém tem este código: o hash é de um texto que nunca sai daqui. O link
  // aparece como ativo só para mostrar a tela; a página pública recusa a conta de exemplo.
  const acessoDoContador: Prisma.AcessoDoContadorCreateManyInput = {
    id: "exemplo-acesso-contador",
    usuarioId: U,
    codigoHash: createHash("sha256").update(`exemplo-sem-codigo-${agora.getTime()}-${Math.random()}`).digest("hex"),
    criadoEm: new Date(agora.getTime() - 20 * 86_400_000),
    ultimoAcessoEm: new Date(agora.getTime() - 2 * 86_400_000),
  };

  const fechadoEm = new Date(Math.min(instante(`${mesAtual}-03`, "18:00").getTime(), agora.getTime() - 3_600_000));

  return {
    usuario: {
      id: U,
      nome: "Carolina Mendes",
      nomeNegocio: "Studio Ipê Beleza",
      email: EMAIL_DO_ESTUDIO_DE_EXEMPLO,
      // Não é hash de senha nenhuma: o login recusa a conta antes de comparar.
      senhaHash: "conta-de-exemplo-sem-senha",
      papel: PAPEL_DA_DEMONSTRACAO,
      telefone: "19990001234",
      documento: "11222333000181",
      cep: "13010000",
      endereco: "Rua das Paineiras, 250, Centro, Campinas/SP",
      // Chave Pix num domínio que não existe: o QR Code de exemplo não paga ninguém.
      pixChave: "pix@studio-ipe.invalid",
      pixCidade: "Campinas",
      ramo: "salão de beleza",
      impostoPercentual: 6,
      iaAceitaEm: new Date(agora.getTime() - 30 * 86_400_000),
      criadoEm: agora,
      assinatura: {
        create: {
          status: "ativa",
          plano: "vip_anual",
          // Completo permanente: a demonstração mostra todas as funções.
          validaAte: new Date("2100-01-01T00:00:00.000Z"),
        },
      },
    },
    clientes,
    servicos,
    colaboradores,
    ausencias,
    agendamentos,
    lancamentos,
    pagamentosDaEquipe,
    cobrancas,
    lembretes,
    repeticoes,
    vencimentos,
    documentos,
    itensDosDocumentos,
    conversas,
    mensagens,
    usosDeIa,
    agendaOnline,
    faixas,
    acessoDoContador,
    mesFechado: { competencia: mesAnterior, fechadoEm },
  };
}
