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
 * O estúdio precisa parecer um salão de verdade e saudável, porque é ele que a
 * pessoa olha antes de assinar. Por isso as contas fecham como num salão de
 * Campinas com três pessoas atendendo: faturamento perto de R$ 16 mil por mês,
 * equipe paga toda semana pelo que atendeu, contas fixas espalhadas pelo mês e
 * sobra entre 20% e 35% depois do imposto estimado. O DAS não entra como
 * saída: o "imposto estimado" das Finanças já é ele, e lançar os dois contaria
 * o imposto duas vezes. Os testes conferem cada mês, inclusive o que está
 * correndo, em qualquer dia em que a demonstração for aberta.
 *
 * Nada aqui fala de inteligência artificial quando ela está desligada no
 * servidor: sem IA, não há conversa do assistente, documento lido, uso de IA
 * nem custo classificado "pela IA". Quem decide é quem chama (estudio.ts), a
 * partir de recursoLigado().
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
import { impostoEstimado } from "@/lib/relatorio/montar";
import { ocorrenciasQueFaltam } from "@/lib/vencimento";
import {
  EMAIL_DO_ESTUDIO_DE_EXEMPLO,
  ID_DO_ESTUDIO_DE_EXEMPLO,
  PAPEL_DA_DEMONSTRACAO,
} from "./conta";

/** O endereço da página pública de exemplo. Ela existe só para aparecer na tela. */
export const LINK_DO_EXEMPLO = "demonstracao-bossa";

const U = ID_DO_ESTUDIO_DE_EXEMPLO;

/**
 * O que está ligado neste servidor e muda o que o exemplo mostra. Vem de
 * recursoLigado() (lib/recursos.ts); aqui é só um parâmetro, para os testes
 * montarem o estúdio dos dois jeitos.
 */
export type RecursosDoExemplo = {
  /** A IA da Anthropic: assistente e classificação de custos. */
  ia: boolean;
  /** A leitura de documentos (IA mais o armazenamento de arquivos). */
  documentos: boolean;
};

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

/** Um item da lista, com chance proporcional ao peso. */
function porPeso<T>(sorteio: () => number, itens: T[], peso: (item: T) => number): T | null {
  const total = itens.reduce((soma, item) => soma + peso(item), 0);
  if (total <= 0) return null;
  let alvo = sorteio() * total;
  for (const item of itens) {
    alvo -= peso(item);
    if (alvo < 0) return item;
  }
  return itens[itens.length - 1];
}

/* -------------------------------------------------------------- datas */

/** "AAAA-MM-DD" somado de n dias. */
function diaMais(dia: string, n: number) {
  return paraDataPura(somarDiasPuros(deDataPura(dia)!, n));
}

/**
 * O meio-dia de cada dia em São Paulo, guardado: converter fuso pelo Intl é a
 * parte cara da montagem, e o exemplo tem mais de mil horários.
 */
const MEIO_DIA = new Map<string, number>();

/**
 * O instante "AAAA-MM-DD" às "HH:MM" em São Paulo. Parte do meio-dia daquele
 * dia: mesmo se o horário de verão voltar, a troca é de madrugada, longe do
 * horário do estúdio.
 */
function instante(dia: string, horario: string) {
  let meioDia = MEIO_DIA.get(dia);
  if (meioDia === undefined) {
    if (MEIO_DIA.size > 5000) MEIO_DIA.clear();
    meioDia = deHorarioLocal(`${dia}T12:00`)!.getTime();
    MEIO_DIA.set(dia, meioDia);
  }
  const [h, m] = horario.split(":").map(Number);
  return new Date(meioDia + (h * 60 + m - 720) * 60_000);
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

/** O último dia do mês "AAAA-MM". */
function ultimoDiaDoMes(mes: string) {
  return diaDoMes(mes, 31);
}

/** "HH:MM" de minutos desde a meia-noite. */
function horario(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/* ------------------------------------------------------------ cadastro */

/**
 * O horário do estúdio, igual ao do agendamento online: segunda só à tarde,
 * terça a sexta com pausa para o almoço, sábado de manhã até o começo da
 * tarde, domingo fechado. Minutos desde a meia-noite.
 */
export const HORARIO_DO_ESTUDIO: Record<number, [number, number][]> = {
  1: [[810, 1140]],
  2: [[540, 720], [810, 1140]],
  3: [[540, 720], [810, 1140]],
  4: [[540, 720], [810, 1140]],
  5: [[540, 720], [810, 1140]],
  6: [[480, 840]],
};

const NOMES = [
  "Mariana", "Fernanda", "Patrícia", "Camila", "Beatriz", "Renata", "Luciana", "Aline", "Tatiane",
  "Débora", "Gabriela", "Vanessa", "Larissa", "Juliana", "Sandra", "Ana Paula", "Cristiane",
  "Daniela", "Eliane", "Fabiana", "Isabela", "Jéssica", "Karina", "Letícia", "Márcia", "Natália",
  "Priscila", "Raquel", "Tânia", "Viviane", "Adriana", "Bruna", "Carla", "Denise", "Elaine",
  "Flávia", "Giovana", "Helena", "Ingrid", "Joana", "Lívia", "Marta", "Rafaela", "Sabrina",
  "Thaís", "Valéria", "Yasmin", "Alessandra", "Bianca", "Cláudia", "Elisa", "Lorena", "Mônica",
  "Roberta", "Sílvia", "Talita", "Vera", "Rosângela", "Roberto", "Marcelo", "Thiago", "Felipe",
  "Rodrigo",
];
const HOMENS = new Set(["Roberto", "Marcelo", "Thiago", "Felipe", "Rodrigo"]);

const SOBRENOMES = [
  "Souza", "Oliveira", "Lima", "Rocha", "Santos", "Carvalho", "Ferreira", "Costa", "Ribeiro",
  "Martins", "Nunes", "Almeida", "Dias", "Teixeira", "Moreira", "Pires", "Gomes", "Barbosa",
  "Araújo", "Cardoso", "Freitas", "Correia", "Castro", "Campos", "Monteiro", "Vieira", "Lopes",
  "Batista", "Fonseca", "Rezende", "Prado", "Siqueira", "Tavares", "Azevedo", "Cunha", "Marques",
  "Andrade",
];

const OBSERVACOES: Record<number, string> = {
  0: "Prefere horários no fim da tarde.",
  2: "Alergia a amônia: usar coloração sem amônia.",
  5: "Gosta de café sem açúcar.",
  9: "Cabelo cacheado: finalizar com difusor.",
  17: "Pele sensível: nada de ácido na limpeza.",
  24: "Vem com a filha pequena às vezes.",
};

/** Quantas clientes o estúdio tem na ficha. Um salão de bairro com três pessoas atendendo. */
const QUANTAS_CLIENTES = 110;

type Quem = "dona" | "paula" | "kelly";
type Area = "cabelo" | "unhas" | "estetica";

const SERVICOS: {
  chave: string;
  nome: string;
  precoCentavos: number;
  duracaoMin: number;
  area: Area;
  descricao?: string;
  agendavelOnline?: boolean;
  /** Quem atende e com que frequência, no sorteio de cada horário. */
  peso: Partial<Record<Quem, number>>;
}[] = [
  { chave: "corte", nome: "Corte feminino", precoCentavos: 9500, duracaoMin: 60, area: "cabelo", peso: { paula: 4, dona: 2 } },
  { chave: "escova", nome: "Escova modelada", precoCentavos: 6500, duracaoMin: 45, area: "cabelo", peso: { paula: 4, dona: 2 } },
  {
    chave: "coloracao",
    nome: "Coloração",
    precoCentavos: 25000,
    duracaoMin: 120,
    area: "cabelo",
    descricao: "Raiz e comprimento, com produto sem amônia se precisar.",
    peso: { paula: 3 },
  },
  { chave: "hidratacao", nome: "Hidratação", precoCentavos: 12000, duracaoMin: 60, area: "cabelo", peso: { paula: 2, dona: 1 } },
  { chave: "manicure", nome: "Manicure e pedicure", precoCentavos: 7500, duracaoMin: 60, area: "unhas", peso: { kelly: 1 } },
  { chave: "sobrancelha", nome: "Design de sobrancelha", precoCentavos: 5000, duracaoMin: 30, area: "estetica", peso: { dona: 4 } },
  {
    chave: "limpeza",
    nome: "Limpeza de pele",
    precoCentavos: 17000,
    duracaoMin: 90,
    area: "estetica",
    descricao: "Higienização, extração e máscara calmante.",
    agendavelOnline: false,
    peso: { dona: 2 },
  },
];

/**
 * Quem atende, em que dias e quão cheia costuma ser a agenda de cada uma.
 * `ocupacao` é a parte do turno ocupada com atendimento num dia comum.
 */
const AGENDA_DE: Record<Quem, { dias: number[]; ocupacao: number }> = {
  dona: { dias: [1, 2, 3, 4, 5, 6], ocupacao: 0.4 },
  paula: { dias: [2, 3, 4, 5, 6], ocupacao: 0.28 },
  kelly: { dias: [1, 2, 3, 4, 5, 6], ocupacao: 0.3 },
};

/** O que a Kelly recebe por atendimento concluído (MEI, valor combinado). */
const REPASSE_DA_KELLY = 3500;
/** A cota-parte da Paula (parceria): metade do valor dos atendimentos dela. */
const COTA_DA_PAULA_PONTOS = 5000;
const SALARIO_DA_SIMONE = 180000;
/** O líquido que cai na conta dela, já com o INSS descontado. */
const SALARIO_LIQUIDO_DA_SIMONE = 165600;
/** FGTS: 8% do salário, na guia de cada mês. */
const FGTS_DA_SIMONE = 14400;
const ALUGUEL = 280000;
const DIA_DO_ALUGUEL = 15;
const IMPOSTO_PERCENTUAL = 6;

/* ------------------------------------------------------------- montagem */

export function montarEstudioDeExemplo(agora: Date, recursos: RecursosDoExemplo): DadosDoExemplo {
  const sorteio = sorteador(20261016);

  const hoje = paraDataLocal(agora);
  const mesAtual = competenciaAtual(agora);
  const mesAnterior = somarMeses(mesAtual, -1);
  const primeiroMes = somarMeses(mesAtual, -5);
  const inicioDoHistorico = `${primeiroMes}-01`;
  const fimDaAgenda = diaMais(hoje, 13);
  const ehPassado = (quando: Date) => quando.getTime() < agora.getTime();

  /* ---------------------------------------------------------- cadastro */

  const desdeDoEstudio = instante(diaMais(inicioDoHistorico, -400), "10:00");

  /*
    A ficha de clientes: a maioria já vinha antes do período mostrado, e umas
    chegaram no meio dele. Cada uma tem a área que costuma procurar e um peso:
    há as fiéis da manicure de quinze em quinze dias, as que cortam a cada dois
    meses e as que aparecem de vez em quando.
  */
  const sorteioDaFicha = sorteador(19990);
  const perfis = Array.from({ length: QUANTAS_CLIENTES }, (_, i) => {
    const nome = NOMES[i % NOMES.length];
    const sobrenome = SOBRENOMES[(i * 13 + Math.floor(i / NOMES.length) * 7) % SOBRENOMES.length];
    const homem = HOMENS.has(nome);
    const tipo = sorteioDaFicha();
    const fiel = sorteioDaFicha() < 0.25;
    const peso: Record<Area, number> = homem
      ? { cabelo: 0, unhas: 0, estetica: 1 }
      : tipo < 0.32
        ? { cabelo: sorteioDaFicha() < 0.4 ? 1 : 0, unhas: 3, estetica: 0 }
        : tipo < 0.82
          ? { cabelo: 3, unhas: sorteioDaFicha() < 0.3 ? 1 : 0, estetica: sorteioDaFicha() < 0.3 ? 1 : 0 }
          : { cabelo: 1, unhas: 0, estetica: 3 };
    if (fiel) for (const area of Object.keys(peso) as Area[]) peso[area] *= 3;
    const nova = sorteioDaFicha() < 0.22;
    const desde = nova
      ? diaMais(inicioDoHistorico, Math.floor(sorteioDaFicha() * 170))
      : diaMais(inicioDoHistorico, -30 - Math.floor(sorteioDaFicha() * 500));
    return { nome: `${nome} ${sobrenome}`, peso, desde: desde < hoje ? desde : diaMais(hoje, -1) };
  });

  const clientes: Prisma.ClienteCreateManyInput[] = perfis.map((perfil, i) => ({
    id: `exemplo-cliente-${i + 1}`,
    usuarioId: U,
    nome: perfil.nome,
    // Celular de Campinas (DDD 19), um diferente para cada cliente.
    telefone: `199${String(81_000_000 + ((i * 1_734_917) % 18_999_999)).padStart(8, "0")}`,
    observacoes: OBSERVACOES[i] ?? null,
    criadoEm: instante(perfil.desde, "10:00"),
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
      comissaoPontosBase: COTA_DA_PAULA_PONTOS,
      telefone: "19990178422",
    },
    {
      id: ID_DE.kelly,
      usuarioId: U,
      nome: "Kelly Moraes",
      cargo: "Manicure",
      vinculo: "mei",
      inicio: deDataPura(diaMais(inicioDoHistorico, -150))!,
      porAtendimentoCentavos: REPASSE_DA_KELLY,
      telefone: "19990189530",
    },
    {
      id: ID_SIMONE,
      usuarioId: U,
      nome: "Simone Barros",
      cargo: "Recepcionista",
      vinculo: "clt",
      inicio: deDataPura(diaMais(inicioDoHistorico, -300))!,
      salarioCentavos: SALARIO_DA_SIMONE,
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

  const agendamentos: Prisma.AgendamentoCreateManyInput[] = [];
  /** O dia de cada horário, "AAAA-MM-DD". */
  const diaDoHorario = new Map<string, string>();
  /**
   * O que entrou em cada dia e o que cada profissional atendeu: base das
   * entradas do mês, da taxa da maquininha e dos acertos semanais da equipe.
   */
  const producaoDoDia = new Map<string, { totalCentavos: number; paulaCentavos: number; kellyAtendimentos: number }>();
  // Os dias em que Kelly avisou que não atende (ver ausências).
  const kellyFora = new Set([diaMais(hoje, 9), diaMais(hoje, 10)]);

  let numero = 0;
  for (let dia = inicioDoHistorico; dia <= fimDaAgenda; dia = diaMais(dia, 1)) {
    const ehHoje = dia === hoje;
    const semana = diaDaSemana(dia);
    // Domingo fechado. Hoje sempre tem agenda, para a demonstração não abrir
    // vazia: num domingo, o estúdio atende como num sábado.
    const faixasDoDia = HORARIO_DO_ESTUDIO[semana] ?? (ehHoje ? HORARIO_DO_ESTUDIO[6] : null);
    if (!faixasDoDia) continue;

    const distancia = Math.round(
      (deDataPura(dia)!.getTime() - deDataPura(hoje)!.getTime()) / 86_400_000,
    );
    // Passado cheio, hoje mais cheio ainda, futuro enchendo aos poucos, como numa agenda de verdade.
    const fator = distancia < 0 ? 1 : distancia === 0 ? 1.7 : Math.max(0.2, 1 - distancia / 12);
    const clientesDoDia = new Set<string>();

    for (const quem of ["dona", "paula", "kelly"] as Quem[]) {
      if (!AGENDA_DE[quem].dias.includes(semana) && !(ehHoje && semana === 0)) continue;
      if (quem === "kelly" && kellyFora.has(dia)) continue;
      const doQuem = SERVICOS.filter((servico) => servico.peso[quem]);

      for (const [abre, fecha] of faixasDoDia) {
        /*
          Cada turno enche até uma meta, que varia pouco de um dia para o outro,
          e o tempo que sobra vira folga espalhada entre os atendimentos, em
          blocos de 15 minutos. Assim o mês fecha parecido com o anterior, como
          num salão com clientela formada, e a agenda não tem horário batendo.
        */
        const livre = fecha - abre;
        const meta = livre * Math.min(0.9, AGENDA_DE[quem].ocupacao * fator * (0.85 + sorteio() * 0.3));
        const doTurno: (typeof SERVICOS)[number][] = [];
        let ocupado = 0;
        for (;;) {
          const cabem = doQuem.filter((servico) => ocupado + servico.duracaoMin <= livre);
          const servico = porPeso(sorteio, cabem, (item) => item.peso[quem] ?? 0);
          if (!servico || ocupado + servico.duracaoMin / 2 > meta) break;
          doTurno.push(servico);
          ocupado += servico.duracaoMin;
        }
        const folgas: number[] = Array(doTurno.length + 1).fill(0);
        for (let bloco = Math.floor((livre - ocupado) / 15); bloco > 0; bloco--) {
          folgas[Math.floor(sorteio() * folgas.length)] += 1;
        }

        let minuto = abre;
        for (const [posicao, servico] of doTurno.entries()) {
          minuto += folgas[posicao] * 15;
          const comeca = minuto;
          minuto += servico.duracaoMin;

          // A mesma cliente não aparece duas vezes no mesmo dia.
          const candidatas = perfis
            .map((perfil, i) => ({ perfil, id: clientes[i].id! }))
            .filter(({ perfil, id }) => perfil.desde <= dia && !clientesDoDia.has(id));
          const escolhida = porPeso(sorteio, candidatas, ({ perfil }) => perfil.peso[servico.area]);
          if (!escolhida) continue; // Ninguém para esse serviço hoje: o horário fica vago.
          clientesDoDia.add(escolhida.id);

          numero += 1;
          const inicio = instante(dia, horario(comeca));
          const passado = ehPassado(inicio);
          const cancelado = passado && !ehHoje && sorteio() < 0.04;
          const status = cancelado ? "cancelado" : passado ? "concluido" : "agendado";

          // Alguns horários futuros chegaram pelo link nos últimos dias.
          const peloLink = !passado && servico.agendavelOnline !== false && sorteio() < 0.18;
          const marcadoEm = peloLink
            ? new Date(agora.getTime() - Math.floor(sorteio() * 3 * 86_400_000) - 3_600_000)
            : new Date(inicio.getTime() - (2 + Math.floor(sorteio() * 10)) * 86_400_000);

          diaDoHorario.set(`exemplo-horario-${numero}`, dia);
          agendamentos.push({
            id: `exemplo-horario-${numero}`,
            usuarioId: U,
            clienteId: escolhida.id,
            servicoId: `exemplo-servico-${servico.chave}`,
            precoCentavos: servico.precoCentavos,
            inicio,
            status,
            colaboradorId: quem === "dona" ? null : ID_DE[quem],
            origem: peloLink ? "link" : null,
            // Os mais antigos já foram vistos; os de ontem e de hoje aparecem como novidade no Início.
            vistoEm: peloLink && agora.getTime() - marcadoEm.getTime() > 36 * 3_600_000 ? agora : null,
            criadoEm: marcadoEm.getTime() < agora.getTime() ? marcadoEm : agora,
          });

          if (status === "concluido") {
            const producao = producaoDoDia.get(dia) ?? { totalCentavos: 0, paulaCentavos: 0, kellyAtendimentos: 0 };
            producao.totalCentavos += servico.precoCentavos;
            if (quem === "paula") producao.paulaCentavos += servico.precoCentavos;
            if (quem === "kelly") producao.kellyAtendimentos += 1;
            producaoDoDia.set(dia, producao);
          }
        }
      }
    }
  }

  /** Quanto os atendimentos concluídos renderam entre dois dias, inclusive. */
  function producaoEntre(de: string, ate: string) {
    const soma = { totalCentavos: 0, paulaCentavos: 0, kellyAtendimentos: 0 };
    for (const [dia, producao] of producaoDoDia) {
      if (dia < de || dia > ate) continue;
      soma.totalCentavos += producao.totalCentavos;
      soma.paulaCentavos += producao.paulaCentavos;
      soma.kellyAtendimentos += producao.kellyAtendimentos;
    }
    return soma;
  }

  /* -------------------------------------------------------- lançamentos */

  const lancamentos: Prisma.LancamentoCreateManyInput[] = [];
  /** O dia de cada lançamento, "AAAA-MM-DD", para não converter fuso de novo. */
  const diaDoLancamento = new Map<string, string>();
  const pagamentosDaEquipe: Prisma.PagamentoDeColaboradorCreateManyInput[] = [];
  const vencimentos: Prisma.VencimentoCreateManyInput[] = [];

  function lancar(
    id: string,
    tipo: "entrada" | "saida",
    descricao: string,
    categoria: string,
    valorCentavos: number,
    dia: string,
    classificacao?: { natureza: string; origem: "regra" | "ia" | "voce"; motivo?: string } | "regra" | null,
  ) {
    // Lançamento é dinheiro que já entrou ou saiu: nada antes do histórico nem depois de hoje.
    if (dia > hoje || dia < inicioDoHistorico || valorCentavos <= 0) return false;
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
    diaDoLancamento.set(id, dia);
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
    const natureza = naturezaDoPagamentoDaEquipe(tipo);
    const lancou = lancar(
      `${id}-saida`,
      "saida",
      descricaoDoLancamento(tipo, nome),
      categoriaDoPagamento(tipo),
      valorCentavos,
      dia,
      // Encargo não tem natureza própria: a regra resolve pela categoria ("Salários e encargos").
      natureza ? { natureza: natureza.natureza, origem: "regra", motivo: natureza.motivo } : "regra",
    );
    if (!lancou) return;
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

  /*
    A equipe que ganha pelo que atende é paga toda semana, no sábado, pelo que
    atendeu de domingo a sábado, e no último dia do mês pelo que sobrou dele.
    Assim cada acerto fica no próprio mês (a competência é o mês do trabalho) e
    a saída acompanha a entrada: o mês que está correndo não abre no vermelho
    por causa do trabalho do mês passado.
  */
  const fechamentosDeSemana: string[] = [];
  for (let dia = inicioDoHistorico; dia < hoje; dia = diaMais(dia, 1)) {
    if (diaDaSemana(dia) === 6 || dia === ultimoDiaDoMes(dia.slice(0, 7))) fechamentosDeSemana.push(dia);
  }
  let desdeOAcerto = inicioDoHistorico;
  for (const dia of fechamentosDeSemana) {
    const producao = producaoEntre(desdeOAcerto, dia);
    const competencia = dia.slice(0, 7);
    pagarEquipe(
      `exemplo-pagamento-paula-${dia}`,
      ID_DE.paula,
      "Paula Andrade",
      "cota_parte",
      competencia,
      Math.round((producao.paulaCentavos * COTA_DA_PAULA_PONTOS) / 10_000),
      dia,
    );
    pagarEquipe(
      `exemplo-pagamento-kelly-${dia}`,
      ID_DE.kelly,
      "Kelly Moraes",
      "repasse",
      competencia,
      producao.kellyAtendimentos * REPASSE_DA_KELLY,
      dia,
    );
    desdeOAcerto = diaMais(dia, 1);
  }

  /**
   * Uma conta que chega todo mês no mesmo dia. Os meses que passaram já foram
   * pagos e viraram saída; a do mês em que ela vence agora fica em aberto, em
   * Vencimentos, e não vira saída: a mesma conta nunca aparece paga e em
   * aberto no mesmo mês.
   */
  function contaDoMes({
    chave,
    descricao,
    categoria,
    valor,
    vence,
    meses = 7,
    classificacao = "regra",
  }: {
    chave: string;
    descricao: (quantosAntes: number) => string;
    categoria: string;
    valor: (mes: string) => number;
    /** O dia, "AAAA-MM-DD", em que vence a que está em aberto. */
    vence: string;
    /** Quantas vezes ela já chegou, contando a que está em aberto. O que cair antes do histórico fica de fora. */
    meses?: number;
    classificacao?: Parameters<typeof lancar>[6];
  }) {
    const mesDoAberto = vence.slice(0, 7);
    const dia = Number(vence.slice(8, 10));
    for (let antes = meses - 1; antes >= 1; antes--) {
      const mes = somarMeses(mesDoAberto, -antes);
      lancar(`exemplo-${chave}-${mes}`, "saida", descricao(antes), categoria, valor(mes), diaDoMes(mes, dia), classificacao);
    }
    vencimentos.push({
      id: `exemplo-vencimento-${chave}`,
      usuarioId: U,
      tipo: "conta",
      descricao: descricao(0),
      categoria,
      valorCentavos: valor(mesDoAberto),
      data: deDataPura(vence)!,
    });
  }

  const variacaoDoMes = new Map<string, number>();
  /** Uma variação de 0,85 a 1,15, a mesma para o mesmo mês e a mesma conta. */
  const variacao = (chave: string, mes: string) => {
    const id = `${chave}|${mes}`;
    if (!variacaoDoMes.has(id)) {
      const n = createHash("sha256").update(id).digest().readUInt32BE(0) / 4294967296;
      variacaoDoMes.set(id, 0.85 + n * 0.3);
    }
    return variacaoDoMes.get(id)!;
  };

  // Contas da casa e fornecedor, com uma em aberto perto de hoje.
  contaDoMes({
    chave: "energia",
    descricao: () => "Conta de energia",
    categoria: "Contas da casa",
    valor: (mes) => Math.round(41280 * variacao("energia", mes)),
    vence: diaMais(hoje, 1),
  });
  contaDoMes({
    chave: "internet",
    descricao: () => "Internet fibra",
    categoria: "Contas da casa",
    valor: () => 11990,
    vence: diaMais(hoje, 3),
  });
  contaDoMes({
    chave: "fornecedor",
    descricao: () => "Boleto do fornecedor de cosméticos",
    categoria: "Produtos",
    valor: (mes) => Math.round(72000 * variacao("produtos", mes)),
    vence: diaMais(hoje, -2),
  });
  contaDoMes({
    chave: "seguro",
    descricao: (antes) => `Seguro do salão (parcela ${4 - antes} de 10)`,
    categoria: "Seguros",
    valor: () => 18900,
    vence: diaMais(hoje, 12),
    meses: 4,
  });

  for (let passo = 0; passo < 6; passo++) {
    const mes = somarMeses(primeiroMes, passo);
    const ultimoDia = ultimoDiaDoMes(mes);

    lancar(`exemplo-aluguel-${mes}`, "saida", "Aluguel do salão", "Aluguel", ALUGUEL, diaDoMes(mes, DIA_DO_ALUGUEL), "regra");
    lancar(`exemplo-agua-${mes}`, "saida", "Conta de água", "Contas da casa", Math.round(9800 * variacao("agua", mes)), diaDoMes(mes, 14), "regra");
    lancar(`exemplo-contador-${mes}`, "saida", "Honorários do escritório de contabilidade", "Serviços", 35000, diaDoMes(mes, 20), "regra");
    lancar(`exemplo-descartaveis-${mes}`, "saida", "Material descartável", "Produtos", Math.round(14500 * variacao("descartaveis", mes)), diaDoMes(mes, 20), "regra");
    /*
      A despesa que a regra automática não resolve. Com a IA ligada, ela aparece
      como sugestão da IA, para a tela de Custos mostrar como isso fica; com a IA
      desligada, foi a própria dona quem classificou.
    */
    lancar(
      `exemplo-lavanderia-${mes}`,
      "saida",
      "Lavanderia das toalhas e capas",
      "Serviços",
      Math.round(18500 * variacao("lavanderia", mes)),
      diaDoMes(mes, 25),
      recursos.ia
        ? {
            natureza: "variavel",
            origem: "ia",
            motivo: "Toalhas e capas vão para a lavanderia conforme o número de atendimentos.",
          }
        : { natureza: "variavel", origem: "voce" },
    );
    // A taxa da maquininha acompanha o que se recebe no cartão: perto de 1,4% de tudo o que entrou no mês.
    const diaDaTaxa = diaDoMes(mes, 28);
    lancar(
      `exemplo-maquininha-${mes}`,
      "saida",
      "Taxa da maquininha de cartão",
      "Taxas",
      Math.round(producaoEntre(`${mes}-01`, diaDaTaxa).totalCentavos * 0.014),
      diaDaTaxa,
      "regra",
    );
    lancar(`exemplo-revenda-${mes}`, "entrada", "Venda de produtos no balcão", "Vendas", Math.round(32000 * variacao("revenda", mes)), diaDoMes(mes, 18));
    if (passo % 2 === 0) {
      lancar(`exemplo-presente-${mes}`, "entrada", "Vale-presente", "Vendas", 15000, diaDoMes(mes, 9));
    }
    if (passo === 2) {
      lancar(`exemplo-juros-${mes}`, "saida", "Juros do cartão da empresa", "Banco", 4890, diaDoMes(mes, 22), {
        natureza: "nao_operacional",
        origem: "voce",
      });
    }

    // Simone (CLT) recebe no último dia útil do mês trabalhado; o FGTS daquele mês sai na guia do dia 20 seguinte.
    let diaDoSalario = ultimoDia;
    while (diaDaSemana(diaDoSalario) === 0 || diaDaSemana(diaDoSalario) === 6) diaDoSalario = diaMais(diaDoSalario, -1);
    pagarEquipe(`exemplo-pagamento-simone-${mes}`, ID_SIMONE, "Simone Barros", "salario", mes, SALARIO_LIQUIDO_DA_SIMONE, diaDoSalario);
    pagarEquipe(`exemplo-encargos-simone-${mes}`, ID_SIMONE, "Simone Barros", "encargo", somarMeses(mes, -1), FGTS_DA_SIMONE, diaDoMes(mes, 20));
  }

  /*
    Duas despesas recentes ainda sem classificação, para a tela de Custos ter o
    que mostrar. Nos primeiros dias do mês elas ficam no fim do mês passado: o
    mês que mal começou não abre com saída antes de quase nenhuma entrada.
  */
  const comecoDoMesAtual = Number(hoje.slice(8, 10)) < 5;
  const recente = (dias: number) => (comecoDoMesAtual ? diaMais(`${mesAtual}-01`, -dias) : diaMais(hoje, -dias));
  lancar("exemplo-sem-classe-1", "saida", "Conserto da cadeira do lavatório", "Manutenção", 18000, recente(2));
  lancar("exemplo-sem-classe-2", "saida", "Café e lanche da equipe", "Outros", 6400, recente(1));

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

  /*
    Os lembretes já enviados seguem a ordem em que o Bossa sugere: véspera, dia,
    três e sete dias depois. Cobrança atrasada nunca fica com o "lembrete da
    véspera" para trás, senão a tela sugeriria um aviso gentil, de antes de
    vencer, para quem já está devendo há semanas.
  */
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
    { chave: "atraso-8", atendidoHa: 15, vence: -8, situacao: "aberta", lembretes: ["antes", "no_dia", "tres_dias"] },
    { chave: "atraso-16", atendidoHa: 24, vence: -16, situacao: "aberta", lembretes: ["antes", "no_dia", "tres_dias", "sete_dias"] },
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
      valorCentavos: ALUGUEL,
      primeira: deDataPura(diaDoMes(primeiroMes, DIA_DO_ALUGUEL))!,
      criadoEm: desdeDoEstudio,
    },
  ];

  // O aluguel dos meses que passaram já foi pago, e a saída é o lançamento do mês.
  for (const lancamento of lancamentos.filter((item) => item.id?.startsWith("exemplo-aluguel-"))) {
    const dia = diaDoLancamento.get(lancamento.id!)!;
    vencimentos.push({
      id: `exemplo-vencimento-aluguel-${dia.slice(0, 7)}`,
      usuarioId: U,
      tipo: "conta",
      descricao: "Aluguel do salão",
      categoria: "Aluguel",
      valorCentavos: ALUGUEL,
      data: deDataPura(dia)!,
      pago: true,
      pagoEm: deDataPura(dia)!,
      lancamentoId: lancamento.id,
      repeticaoId: "exemplo-repeticao-aluguel",
    });
  }
  // Os próximos doze, do mesmo jeito que a tela completaria sozinha.
  const jaGravadas = vencimentos
    .filter((item) => item.repeticaoId === "exemplo-repeticao-aluguel")
    .map((item) => item.data as Date);
  for (const data of ocorrenciasQueFaltam({
    primeira: deDataPura(diaDoMes(primeiroMes, DIA_DO_ALUGUEL))!,
    jaGravadas,
    hoje: deDataPura(hoje)!,
  })) {
    vencimentos.push({
      id: `exemplo-vencimento-aluguel-${paraDataPura(data)}`,
      usuarioId: U,
      tipo: "conta",
      descricao: "Aluguel do salão",
      categoria: "Aluguel",
      valorCentavos: ALUGUEL,
      data,
      repeticaoId: "exemplo-repeticao-aluguel",
    });
  }

  /*
    O DAS vence todo dia 20 e é o imposto do mês anterior. Ele fica aqui como
    lembrete, com o valor do imposto estimado daquele mês, e nunca vira saída
    no exemplo: as Finanças já descontam o imposto estimado de cada mês.
  */
  const diaDoDas = diaDoMes(mesAtual, 20) >= hoje ? diaDoMes(mesAtual, 20) : diaDoMes(somarMeses(mesAtual, 1), 20);
  const mesDoImposto = somarMeses(diaDoDas.slice(0, 7), -1);
  const entradasDoMes = (mes: string) =>
    producaoEntre(`${mes}-01`, ultimoDiaDoMes(mes)).totalCentavos +
    lancamentos
      .filter((item) => item.tipo === "entrada" && diaDoLancamento.get(item.id!)!.startsWith(mes))
      .reduce((soma, item) => soma + item.valorCentavos, 0);
  vencimentos.push({
    id: "exemplo-vencimento-das",
    usuarioId: U,
    tipo: "conta",
    descricao: "DAS do Simples Nacional",
    categoria: "Impostos",
    valorCentavos: impostoEstimado(entradasDoMes(mesDoImposto), IMPOSTO_PERCENTUAL) || 95000,
    data: deDataPura(diaDoDas)!,
  });

  for (const prazo of [
    { chave: "reajuste", descricao: "Reajuste do aluguel pelo IGP-M", dias: 48 },
    { chave: "fim-contrato", descricao: "Fim do contrato de locação do salão", dias: 230 },
  ]) {
    vencimentos.push({
      id: `exemplo-vencimento-${prazo.chave}`,
      usuarioId: U,
      tipo: "prazo",
      descricao: prazo.descricao,
      data: deDataPura(diaMais(hoje, prazo.dias))!,
    });
  }

  /* --------------------------------------------------------- documentos */

  const fimDoContrato = deDataPura(diaMais(hoje, 230))!;
  const reajuste = deDataPura(diaMais(hoje, 48))!;
  const energiaEmAberto = vencimentos.find((item) => item.id === "exemplo-vencimento-energia")!;
  const documentos: Prisma.DocumentoCreateManyInput[] = [];
  const itensDosDocumentos: Prisma.ItemDoDocumentoCreateManyInput[] = [];
  // A leitura de documentos é feita pela IA: sem ela, a demonstração não mostra documento lido.
  if (recursos.documentos) {
    documentos.push(
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
          "Locação da sala comercial do salão por 30 meses, com aluguel de R$ 2.800,00 todo dia 15, reajuste anual pelo IGP-M e IPTU dividido em parcelas pagas junto com o aluguel.",
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
    );
    itensDosDocumentos.push(
      {
        id: "exemplo-item-aluguel",
        documentoId: "exemplo-documento-contrato",
        descricao: "Aluguel mensal da sala",
        tipo: "saida",
        valorCentavos: ALUGUEL,
        data: deDataPura(diaDoMes(somarMeses(mesAtual, 1), DIA_DO_ALUGUEL))!,
        repeticao: "mensal",
        repeteAte: fimDoContrato,
        trecho: "O LOCATÁRIO pagará o aluguel mensal de R$ 2.800,00 (dois mil e oitocentos reais) até o dia 15 de cada mês.",
        pagina: 2,
      },
      {
        id: "exemplo-item-iptu",
        documentoId: "exemplo-documento-contrato",
        descricao: "Parcela do IPTU",
        tipo: "saida",
        valorCentavos: 18450,
        data: deDataPura(diaDoMes(somarMeses(mesAtual, 1), DIA_DO_ALUGUEL))!,
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
        valorCentavos: energiaEmAberto.valorCentavos,
        data: energiaEmAberto.data,
        trecho: `TOTAL A PAGAR ${reaisNaConta(energiaEmAberto.valorCentavos ?? 0)} — VENCIMENTO`,
        pagina: 1,
        decisao: "aceito",
        vencimentoId: "exemplo-vencimento-energia",
      },
    );
  }

  /* ---------------------------------------------------------- assistente */

  const receitaDoMesAnterior = entradasDoMes(mesAnterior);
  const despesaDoMesAnterior = lancamentos
    .filter((item) => item.tipo === "saida" && diaDoLancamento.get(item.id!)!.startsWith(mesAnterior))
    .reduce((soma, item) => soma + item.valorCentavos, 0);
  const impostoDoMesAnterior = impostoEstimado(receitaDoMesAnterior, IMPOSTO_PERCENTUAL);
  const atendimentosDoMesAnterior = concluidos.filter(
    (item) => diaDoHorario.get(item.id!)!.startsWith(mesAnterior),
  ).length;

  const porDiaDaSemana = [0, 0, 0, 0, 0, 0, 0];
  for (const item of concluidos) porDiaDaSemana[diaDaSemana(diaDoHorario.get(item.id!)!)] += 1;
  const NOMES_DOS_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
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
      `As saídas somaram **${reais(despesaDoMesAnterior)}** e o imposto estimado ficou em ${reais(impostoDoMesAnterior)}, então sobraram **${reais(receitaDoMesAnterior - despesaDoMesAnterior - impostoDoMesAnterior)}** antes do seu pró-labore.`,
      "",
      "Três sugestões:",
      "- O aluguel é o maior custo fixo. Vale olhar a data do reajuste pelo IGP-M em Vencimentos e conversar com a imobiliária antes dela.",
      "- Coloração é o serviço que mais traz por horário. Um pacote com hidratação pode aumentar o valor de cada visita.",
      "- Há cobranças atrasadas em Cobranças: um lembrete hoje costuma resolver.",
      "",
      "Fonte: Finanças, Agenda e Cobranças do Bossa.",
    ].join("\n"),
  };
  const conversaDois = {
    pergunta: "Em que dia a agenda fica mais vazia?",
    resposta: [
      `Nos últimos seis meses, **${NOMES_DOS_DIAS[maisVazio]}** foi o dia com menos atendimentos concluídos (${porDiaDaSemana[maisVazio]}), e **${NOMES_DOS_DIAS[maisCheio]}** o mais cheio (${porDiaDaSemana[maisCheio]}).`,
      "",
      `Uma ideia: oferecer um valor especial de escova ou hidratação na ${NOMES_DOS_DIAS[maisVazio]}, divulgado pelo seu link de agendamento.`,
    ].join("\n"),
  };

  const conversas: Prisma.ConversaDeIaCreateManyInput[] = [];
  const mensagens: Prisma.MensagemDeIaCreateManyInput[] = [];
  const usosDeIa: Prisma.UsoDeIaCreateManyInput[] = [];
  // Sem IA no servidor, o assistente nem aparece: nada de conversa nem de uso de exemplo.
  if (recursos.ia) {
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
    usosDeIa.push(
      { id: "exemplo-uso-1", usuarioId: U, recurso: "assistente", unidades: 1, criadoEm: noMes(30) },
      { id: "exemplo-uso-2", usuarioId: U, recurso: "assistente", unidades: 1, criadoEm: noMes(60) },
      { id: "exemplo-uso-3", usuarioId: U, recurso: "classificacao", unidades: 12, criadoEm: noMes(40) },
    );
    if (recursos.documentos) {
      usosDeIa.push({ id: "exemplo-uso-4", usuarioId: U, recurso: "leitura", unidades: 1, criadoEm: noMes(50) });
    }
  }

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
  for (const [dia, faixasDoDia] of Object.entries(HORARIO_DO_ESTUDIO)) {
    faixasDoDia.forEach(([inicioMin, fimMin], i) => {
      faixas.push({ id: `exemplo-faixa-${dia}-${i + 1}`, usuarioId: U, diaDaSemana: Number(dia), inicioMin, fimMin });
    });
  }

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
      impostoPercentual: IMPOSTO_PERCENTUAL,
      // Também é a marca de como o exemplo foi montado: estudio.ts refaz quando a IA liga ou desliga.
      iaAceitaEm: recursos.ia ? new Date(agora.getTime() - 30 * 86_400_000) : null,
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

/** "R$ 412,80", do jeito que vem impresso na conta. */
function reaisNaConta(centavos: number) {
  return (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
