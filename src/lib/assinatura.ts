import { dataCurta, paraDataLocal, somarDias } from "@/lib/formato";
import { montarPix } from "@/lib/pix";

const DIA_MS = 24 * 60 * 60 * 1000;

export const DIAS_POR_CICLO = 30;
/**
 * Dias que a administração dá de presente com "Dar cortesia". Era o mesmo
 * número do teste grátis, que acabou: quem cria conta agora conhece o Bossa
 * pela demonstração. A cortesia continua existindo para casos combinados.
 */
export const DIAS_DE_CORTESIA = 3;

export const PIX_CHAVE = process.env.PIX_CHAVE ?? "";
export const PIX_NOME = process.env.PIX_NOME ?? "";

/*
  Preços em centavos. As variáveis de ambiente (no Netlify) mandam mais que o
  código: se alguma delas estiver preenchida lá, é o valor dela que vale, e os
  números abaixo só servem quando a variável não existe.

  Os nomes das variáveis são novos (PLANO_*), de propósito: as antigas
  (ASSINATURA_VALOR_CENTAVOS e companhia) guardavam os preços do Simples e do
  Completo, e se alguma ainda estiver no Netlify ela não pode puxar o Normal
  para o preço antigo sem ninguém perceber.
*/
function centavosDoAmbiente(nome: string, padrao: number) {
  const valor = Number(process.env[nome]);
  // Variável vazia, com letra ou zerada cairia num plano de graça: usa o padrão.
  return Number.isInteger(valor) && valor > 0 ? valor : padrao;
}

/**
 * Os códigos antigos continuam: "mensal"/"anual" é o Normal (era o Simples) e
 * "vip_*" é o VIP (era o Completo). Eles estão gravados nas assinaturas e nos
 * pagamentos de quem já assina: trocar o texto mudaria o plano de quem pagou.
 * Quem tinha o Simples ganha o Normal, que libera o mesmo; quem tinha o
 * Completo ganha o VIP, que libera tudo. Ninguém perde nada.
 */
export type CodigoPlano = "mensal" | "anual" | "pro_mensal" | "pro_anual" | "vip_mensal" | "vip_anual";
export type FamiliaDoPlano = "normal" | "pro" | "vip";

/** Do mais barato ao mais completo. Cada um tem tudo do anterior. */
export const FAMILIAS: FamiliaDoPlano[] = ["normal", "pro", "vip"];

/** 1 = Normal, 2 = Pro, 3 = VIP. Serve para "este plano tem pelo menos o Pro". */
export const NIVEL_DA_FAMILIA: Record<FamiliaDoPlano, number> = { normal: 1, pro: 2, vip: 3 };

export type Plano = {
  codigo: CodigoPlano;
  nome: string;
  familia: FamiliaDoPlano;
  periodo: string;
  valorCentavos: number;
  dias: number;
};

export const NOME_DA_FAMILIA: Record<FamiliaDoPlano, string> = {
  normal: "Normal",
  pro: "Pro",
  vip: "VIP",
};

function plano(
  codigo: CodigoPlano,
  familia: FamiliaDoPlano,
  anual: boolean,
  variavel: string,
  padrao: number,
): Plano {
  return {
    codigo,
    nome: `${NOME_DA_FAMILIA[familia]} ${anual ? "anual" : "mensal"}`,
    familia,
    periodo: anual ? "por ano" : "por mês",
    valorCentavos: centavosDoAmbiente(variavel, padrao),
    dias: anual ? 365 : DIAS_POR_CICLO,
  };
}

/** O anual custa dez mensalidades nos três planos: dois meses de presente. */
export const PLANOS: Record<CodigoPlano, Plano> = {
  mensal: plano("mensal", "normal", false, "PLANO_NORMAL_MENSAL_CENTAVOS", 7900),
  anual: plano("anual", "normal", true, "PLANO_NORMAL_ANUAL_CENTAVOS", 79000),
  pro_mensal: plano("pro_mensal", "pro", false, "PLANO_PRO_MENSAL_CENTAVOS", 12900),
  pro_anual: plano("pro_anual", "pro", true, "PLANO_PRO_ANUAL_CENTAVOS", 129000),
  vip_mensal: plano("vip_mensal", "vip", false, "PLANO_VIP_MENSAL_CENTAVOS", 18900),
  vip_anual: plano("vip_anual", "vip", true, "PLANO_VIP_ANUAL_CENTAVOS", 189000),
};

/** O mensal e o anual de um plano, nessa ordem. */
export function planosDaFamilia(familia: FamiliaDoPlano): [Plano, Plano] {
  if (familia === "normal") return [PLANOS.mensal, PLANOS.anual];
  if (familia === "pro") return [PLANOS.pro_mensal, PLANOS.pro_anual];
  return [PLANOS.vip_mensal, PLANOS.vip_anual];
}

/** Traduz "normal", "pro" ou "vip" vindo de um link; o resto vira null. */
export function familiaPorTexto(valor: unknown): FamiliaDoPlano | null {
  return typeof valor === "string" && (FAMILIAS as string[]).includes(valor)
    ? (valor as FamiliaDoPlano)
    : null;
}

/**
 * Quanto o anual economiza em relação a doze mensalidades do mesmo plano.
 *
 * Calculado, nunca escrito à mão: um texto fixo como "2 meses de brinde"
 * ficaria errado quando o preço mudar no Netlify. Nunca devolve negativo: se
 * alguém configurar o anual mais caro que doze meses, a tela não fala em economia.
 */
export function economiaDoAnual(familia: FamiliaDoPlano) {
  const [mensal, anual] = planosDaFamilia(familia);
  return Math.max(0, mensal.valorCentavos * 12 - anual.valorCentavos);
}

/** O anual dividido por doze, em centavos, arredondado para baixo: "sai por R$ X ao mês". */
export function mensalDoAnual(familia: FamiliaDoPlano) {
  return Math.floor(planosDaFamilia(familia)[1].valorCentavos / 12);
}

/** Traduz o que veio do formulário ou do banco; o que não reconhecer vira mensal. */
export function planoPorCodigo(valor: unknown): Plano {
  if (typeof valor === "string" && Object.hasOwn(PLANOS, valor)) {
    return PLANOS[valor as CodigoPlano];
  }
  return PLANOS.mensal;
}

/** O que existe no banco, só o que as regras de plano precisam ler. */
export type AssinaturaParaPlano = { status: string; plano: string; validaAte: Date };

/**
 * O plano pago que está valendo agora, ou null. Só conta assinatura "ativa"
 * (um Pix já confirmado) dentro da validade: o teste antigo e a demonstração
 * não são plano pago, e assinatura vencida não tem plano valendo.
 */
export function planoValendo(
  assinatura: AssinaturaParaPlano | null | undefined,
  agora = new Date(),
): Plano | null {
  if (!assinatura) return null;
  if (assinatura.status !== "ativa") return null;
  if (assinatura.validaAte.getTime() <= agora.getTime()) return null;
  return planoPorCodigo(assinatura.plano);
}

/** Se o plano pago e em dia é pelo menos o pedido (o VIP tem tudo do Pro, que tem tudo do Normal). */
export function temPlanoAoMenos(
  assinatura: AssinaturaParaPlano | null | undefined,
  familia: FamiliaDoPlano,
  agora = new Date(),
) {
  const vigente = planoValendo(assinatura, agora);
  return vigente ? NIVEL_DA_FAMILIA[vigente.familia] >= NIVEL_DA_FAMILIA[familia] : false;
}

/**
 * "teste": o teste grátis antigo, que ainda vale para quem o começou antes da
 * demonstração existir. "demonstracao": conta criada depois, que nunca pagou.
 * "aguardando" não se grava na assinatura: sai de um Pix avisado e não conferido.
 */
export type StatusAssinatura = "teste" | "demonstracao" | "aguardando" | "ativa" | "expirada";

export type AssinaturaResumo = {
  status: string;
  validaAte: Date;
};

/** A partir de quantos dias para o fim da validade o painel começa a avisar. */
export const DIAS_PARA_AVISAR_O_FIM = 5;

export type SituacaoAssinatura = {
  status: StatusAssinatura;
  /** Pode usar o painel com os próprios dados (assinatura em dia ou teste antigo valendo). */
  liberada: boolean;
  emTeste: boolean;
  /**
   * Nunca pagou e não tem teste valendo: vê o estúdio de exemplo, e toda ação
   * leva à tela de assinatura. Quem já pagou e venceu NÃO cai aqui: vai para a
   * assinatura com os próprios dados guardados, como sempre foi.
   */
  demonstracao: boolean;
  /**
   * Dias de calendário, no fuso de São Paulo, de hoje até o dia da validade:
   * 0 quando vence hoje, 1 quando vence amanhã. Contar em horas (24h por dia)
   * dava "faltam 2 dias" para quem vence amanhã de manhã.
   */
  diasRestantes: number;
  /** Assinatura paga e valendo, com {@link DIAS_PARA_AVISAR_O_FIM} dias ou menos pela frente. */
  venceLogo: boolean;
  /** O último Pix avisado foi marcado como não localizado e nada mais foi avisado depois. */
  pixNaoLocalizado?: boolean;
  validaAte: Date;
  recado: string;
};

export const RECADO_DA_DEMONSTRACAO =
  "Você está vendo um estúdio de exemplo. Para usar com os seus clientes, escolha um plano.";

/** Quantos dias de calendário (em São Paulo) vão de `agora` até `ate`. Nunca negativo. */
export function diasDeCalendarioAte(ate: Date, agora = new Date()) {
  const hoje = Date.parse(`${paraDataLocal(agora)}T00:00:00.000Z`);
  const dia = Date.parse(`${paraDataLocal(ate)}T00:00:00.000Z`);
  return Math.max(0, Math.round((dia - hoje) / DIA_MS));
}

export function avaliarAssinatura(
  assinatura: AssinaturaResumo | null | undefined,
  agora = new Date(),
): SituacaoAssinatura {
  if (!assinatura) {
    // Sem assinatura nenhuma é conta que nunca pagou: conhece pela demonstração.
    return {
      status: "demonstracao",
      liberada: false,
      emTeste: false,
      demonstracao: true,
      diasRestantes: 0,
      venceLogo: false,
      validaAte: agora,
      recado: RECADO_DA_DEMONSTRACAO,
    };
  }

  const validaAte = assinatura.validaAte;
  const dentroDoPrazo = validaAte.getTime() > agora.getTime();
  const diasRestantes = dentroDoPrazo ? diasDeCalendarioAte(validaAte, agora) : 0;

  /*
    Só "ativa" quer dizer que um Pix já foi confirmado (é o que a confirmação do
    admin grava). "teste" e "demonstracao" são de quem nunca pagou: fora do
    teste antigo valendo, viram demonstração, e não "assinatura vencida".
  */
  const nuncaPagou = assinatura.status === "teste" || assinatura.status === "demonstracao";
  const testeValendo = assinatura.status === "teste" && dentroDoPrazo;

  if (nuncaPagou && !testeValendo) {
    return {
      status: "demonstracao",
      liberada: false,
      emTeste: false,
      demonstracao: true,
      diasRestantes: 0,
      venceLogo: false,
      validaAte,
      recado: RECADO_DA_DEMONSTRACAO,
    };
  }

  const status: StatusAssinatura = dentroDoPrazo
    ? (assinatura.status as StatusAssinatura)
    : "expirada";

  const emTeste = status === "teste" && dentroDoPrazo;
  const liberada = dentroDoPrazo && (status === "ativa" || status === "teste");
  const venceLogo = status === "ativa" && dentroDoPrazo && diasRestantes <= DIAS_PARA_AVISAR_O_FIM;

  return {
    status,
    liberada,
    emTeste,
    demonstracao: false,
    diasRestantes,
    venceLogo,
    validaAte,
    recado: montarRecado(status, dentroDoPrazo, diasRestantes, validaAte),
  };
}

/**
 * "Faltam 3 dias", "amanhã" ou "hoje", para a validade. O Bossa não cobra
 * sozinho (o Pix é feito à mão a cada período), então a tela fala de validade
 * ("vale até"), nunca de "renova em".
 */
export function quandoVence(diasRestantes: number) {
  if (diasRestantes <= 0) return "hoje";
  if (diasRestantes === 1) return "amanhã";
  return `faltam ${diasRestantes} dias`;
}

function montarRecado(
  status: StatusAssinatura,
  dentroDoPrazo: boolean,
  diasRestantes: number,
  validaAte: Date,
) {
  if (status === "teste" && dentroDoPrazo) {
    if (diasRestantes === 0) return "Seu período de teste termina hoje. Que tal garantir o próximo mês agora?";
    return diasRestantes === 1
      ? "Seu período de teste termina amanhã. Que tal garantir o próximo mês agora?"
      : `Você está no período de teste: faltam ${diasRestantes} dias para ele terminar.`;
  }

  if (status === "ativa" && dentroDoPrazo) {
    const data = dataCurta(validaAte);
    if (diasRestantes > DIAS_PARA_AVISAR_O_FIM) return `Sua assinatura está em dia e vale até ${data}.`;
    const quando =
      diasRestantes === 0 ? `vale só até hoje, ${data}` : diasRestantes === 1 ? `vale até amanhã, ${data}` : `vale até ${data} (${quandoVence(diasRestantes)})`;
    return `Sua assinatura ${quando}. Faça o Pix para continuar usando sem interrupção.`;
  }

  if (status === "aguardando") {
    return "Recebemos o aviso do seu Pix. Estamos conferindo e liberamos o acesso em seguida.";
  }

  return "Sua assinatura venceu. Faça o Pix quando puder para voltar a usar o painel.";
}

/** Nova validade ao confirmar um pagamento: soma os dias do plano sem perder o que sobrou. */
export function novaValidade(
  validaAte: Date | null,
  agora = new Date(),
  dias = DIAS_POR_CICLO,
) {
  const base =
    validaAte && validaAte.getTime() > agora.getTime() ? validaAte : agora;
  return somarDias(base, dias);
}

/** O que sobrou do plano antigo, numa troca de plano, e no que isso virou. */
export type ConversaoDeSaldo = {
  /** O plano que estava valendo. */
  de: CodigoPlano;
  /** Os dias que faltavam, em dinheiro: dias restantes × valor diário do plano antigo. */
  creditoCentavos: number;
  /** O crédito em dias do plano novo, arredondado para baixo. */
  diasExtras: number;
};

export type ResultadoDoPagamento = {
  /** O plano que passa a valer. */
  plano: CodigoPlano;
  validaAte: Date;
  /** Só existe quando o plano muda (Normal, Pro ou VIP) com um plano ainda valendo com um plano ainda valendo. */
  conversao: ConversaoDeSaldo | null;
};

/**
 * Valor que sobra de um plano, em centavos, pelo tempo que ainda falta.
 *
 * Valor diário = preço do plano ÷ dias do ciclo dele. A conta é feita com o
 * tempo exato (em milissegundos) e só o resultado é arredondado para baixo,
 * em centavos inteiros. BigInt porque milissegundos × centavos passa do que um
 * número comum guarda sem perder precisão quando o preço é alto.
 */
function saldoEmCentavos(restanteMs: number, plano: Plano) {
  if (restanteMs <= 0) return 0;
  const saldo =
    (BigInt(Math.floor(restanteMs)) * BigInt(plano.valorCentavos)) / (BigInt(plano.dias) * BigInt(DIA_MS));
  return Number(saldo);
}

/**
 * O que acontece com a assinatura quando um Pix é confirmado. É a regra de
 * troca de plano, num lugar só (a confirmação do admin e as prévias das telas
 * usam esta mesma função):
 *
 * - Mesmo plano que está valendo (Pro mensal → Pro anual, por exemplo), ou
 *   nenhum plano pago valendo: a validade é a maior entre agora
 *   e a atual, mais os dias do plano pago. Renovar antes da hora não perde dia.
 * - Família diferente com um plano ainda valendo: o que falta do plano antigo
 *   vira crédito em dinheiro (dias restantes × valor diário dele), e o crédito
 *   vira dias extras no plano novo (crédito ÷ valor diário do novo, para
 *   baixo). A validade é agora + dias do plano novo + dias extras.
 *
 * Nos dois casos o plano passa a ser o pago. Assim ninguém ganha dias de VIP
 * pagando o Normal, nem perde o dinheiro do VIP ao descer para o Normal.
 */
export function aplicarPagamento(
  atual: AssinaturaParaPlano | null | undefined,
  codigoPago: unknown,
  agora = new Date(),
): ResultadoDoPagamento {
  const novo = planoPorCodigo(codigoPago);
  const vigente = planoValendo(atual, agora);

  if (!atual || !vigente || vigente.familia === novo.familia) {
    return {
      plano: novo.codigo,
      validaAte: novaValidade(atual?.validaAte ?? null, agora, novo.dias),
      conversao: null,
    };
  }

  const creditoCentavos = saldoEmCentavos(atual.validaAte.getTime() - agora.getTime(), vigente);
  // crédito ÷ (valor ÷ dias) = crédito × dias ÷ valor, tudo em inteiros.
  const diasExtras = Math.floor((creditoCentavos * novo.dias) / novo.valorCentavos);

  return {
    plano: novo.codigo,
    validaAte: somarDias(agora, novo.dias + diasExtras),
    conversao: { de: vigente.codigo, creditoCentavos, diasExtras },
  };
}

/**
 * Quanto as assinaturas em dia rendem por mês, em centavos. O anual entra
 * dividido por doze; a soma dos anuais é dividida uma vez só, para o
 * arredondamento não se acumular conta a conta.
 */
export function receitaMensalCentavos(
  assinaturas: (AssinaturaParaPlano | null | undefined)[],
  agora = new Date(),
) {
  let mensais = 0;
  let anuais = 0;
  for (const assinatura of assinaturas) {
    const plano = planoValendo(assinatura, agora);
    if (!plano) continue;
    if (plano.dias >= 365) anuais += plano.valorCentavos;
    else mensais += Math.round((plano.valorCentavos * DIAS_POR_CICLO) / plano.dias);
  }
  return mensais + Math.round(anuais / 12);
}

/**
 * O identificador que vai no código Pix de cada conta (campo 62 do Pix). Antes
 * era "AGENDA" para todo mundo, e o extrato não dizia de quem era o Pix. Só
 * letras e números, até 25 caracteres: "BOSSA" + o fim do id da conta.
 */
export function identificadorDoPix(usuarioId: string) {
  const final = usuarioId.replace(/[^A-Za-z0-9]/g, "").slice(-12).toUpperCase();
  return `BOSSA${final}`;
}

/**
 * O "copia e cola" da mensalidade do Bossa.
 *
 * A montagem em si mora em lib/pix.ts, que é a mesma usada pelas cobranças que
 * cada estúdio manda para os clientes dele. Uma implementação só, um conjunto
 * de testes só: se o código Pix quebrar, quebra num lugar e o teste pega.
 */
export function pixCopiaECola({
  chave,
  nome,
  cidade = "SAO PAULO",
  valorCentavos,
  identificador = "ASSINATURA",
}: {
  chave: string;
  nome: string;
  cidade?: string;
  valorCentavos: number;
  identificador?: string;
}) {
  const resultado = montarPix({ chave, nome, cidade, valorCentavos, identificador });
  // A tela só chama isto depois de conferir que a chave existe; se ainda assim
  // vier errada, devolver texto vazio é melhor do que um código que o banco
  // aceita abrir e recusa pagar.
  return resultado.certo ? resultado.codigo : "";
}
