import { somarDias } from "@/lib/formato";
import { montarPix } from "@/lib/pix";

export const DIAS_DE_TESTE = 3;
export const DIAS_POR_CICLO = 30;

export const PIX_CHAVE = process.env.PIX_CHAVE ?? "";
export const PIX_NOME = process.env.PIX_NOME ?? "";

const MENSAL_CENTAVOS = Number(process.env.ASSINATURA_VALOR_CENTAVOS ?? 16900);
/** Anual sai por dez mensalidades: dois meses de brinde para quem paga adiantado. */
const ANUAL_CENTAVOS = Number(process.env.ASSINATURA_ANUAL_CENTAVOS ?? MENSAL_CENTAVOS * 10);
const VIP_MENSAL_CENTAVOS = Number(process.env.ASSINATURA_VIP_CENTAVOS ?? 32900);
const VIP_ANUAL_CENTAVOS = Number(
  process.env.ASSINATURA_VIP_ANUAL_CENTAVOS ?? VIP_MENSAL_CENTAVOS * 10,
);

export type CodigoPlano = "mensal" | "anual" | "vip_mensal" | "vip_anual";

export type Plano = {
  codigo: CodigoPlano;
  nome: string;
  familia: "essencial" | "vip";
  periodo: string;
  valorCentavos: number;
  dias: number;
  /** Só os planos VIP abrem a aba Finanças. */
  financeiro: boolean;
};

export const PLANOS: Record<CodigoPlano, Plano> = {
  mensal: {
    codigo: "mensal",
    nome: "Essencial mensal",
    familia: "essencial",
    periodo: "por mês",
    valorCentavos: MENSAL_CENTAVOS,
    dias: DIAS_POR_CICLO,
    financeiro: false,
  },
  anual: {
    codigo: "anual",
    nome: "Essencial anual",
    familia: "essencial",
    periodo: "por ano",
    valorCentavos: ANUAL_CENTAVOS,
    dias: 365,
    financeiro: false,
  },
  vip_mensal: {
    codigo: "vip_mensal",
    nome: "VIP mensal",
    familia: "vip",
    periodo: "por mês",
    valorCentavos: VIP_MENSAL_CENTAVOS,
    dias: DIAS_POR_CICLO,
    financeiro: true,
  },
  vip_anual: {
    codigo: "vip_anual",
    nome: "VIP anual",
    familia: "vip",
    periodo: "por ano",
    valorCentavos: VIP_ANUAL_CENTAVOS,
    dias: 365,
    financeiro: true,
  },
};

/** Quanto o VIP anual economiza em relação a doze mensalidades VIP. */
export const ECONOMIA_VIP_ANUAL_CENTAVOS = VIP_MENSAL_CENTAVOS * 12 - VIP_ANUAL_CENTAVOS;

/** Quanto o anual economiza em relação a doze mensalidades. */
export const ECONOMIA_ANUAL_CENTAVOS = MENSAL_CENTAVOS * 12 - ANUAL_CENTAVOS;
export const MESES_DE_BRINDE = Math.round(ECONOMIA_ANUAL_CENTAVOS / MENSAL_CENTAVOS);

/** Traduz o que veio do formulário ou do banco; o que não reconhecer vira mensal. */
export function planoPorCodigo(valor: unknown): Plano {
  if (typeof valor === "string" && valor in PLANOS) {
    return PLANOS[valor as CodigoPlano];
  }
  return PLANOS.mensal;
}

/** A aba Finanças só abre para quem está com um plano VIP em dia. */
export function temFinanceiro(
  assinatura: { status: string; plano: string; validaAte: Date } | null | undefined,
  agora = new Date(),
) {
  if (!assinatura) return false;
  if (assinatura.validaAte.getTime() <= agora.getTime()) return false;
  if (assinatura.status !== "ativa") return false;
  return planoPorCodigo(assinatura.plano).financeiro;
}

/** Mantido para as telas que só falam do mensal. */
export const PLANO = {
  nome: "Plano Estúdio",
  valorCentavos: MENSAL_CENTAVOS,
  pixChave: PIX_CHAVE,
  pixNome: PIX_NOME,
};

export type StatusAssinatura = "teste" | "aguardando" | "ativa" | "expirada";

export type AssinaturaResumo = {
  status: string;
  validaAte: Date;
};

export type SituacaoAssinatura = {
  status: StatusAssinatura;
  liberada: boolean;
  emTeste: boolean;
  diasRestantes: number;
  validaAte: Date;
  recado: string;
};

export function avaliarAssinatura(
  assinatura: AssinaturaResumo | null | undefined,
  agora = new Date(),
): SituacaoAssinatura {
  if (!assinatura) {
    return {
      status: "expirada",
      liberada: false,
      emTeste: false,
      diasRestantes: 0,
      validaAte: agora,
      recado: "Ative sua assinatura para continuar usando o painel.",
    };
  }

  const validaAte = assinatura.validaAte;
  const dentroDoPrazo = validaAte.getTime() > agora.getTime();
  const diasRestantes = Math.max(
    0,
    Math.ceil((validaAte.getTime() - agora.getTime()) / (24 * 60 * 60 * 1000)),
  );

  const status: StatusAssinatura = dentroDoPrazo
    ? (assinatura.status as StatusAssinatura)
    : "expirada";

  const emTeste = status === "teste" && dentroDoPrazo;
  const liberada = dentroDoPrazo && (status === "ativa" || status === "teste");

  return {
    status,
    liberada,
    emTeste,
    diasRestantes,
    validaAte,
    recado: montarRecado(status, dentroDoPrazo, diasRestantes),
  };
}

function montarRecado(
  status: StatusAssinatura,
  dentroDoPrazo: boolean,
  diasRestantes: number,
) {
  if (status === "teste" && dentroDoPrazo) {
    return diasRestantes === 1
      ? "Seu período de teste termina amanhã. Que tal garantir o próximo mês agora?"
      : `Você está no período de teste: faltam ${diasRestantes} dias para ele terminar.`;
  }

  if (status === "ativa" && dentroDoPrazo) {
    return diasRestantes <= 5
      ? `Sua assinatura está em dia e renova em ${diasRestantes} ${diasRestantes === 1 ? "dia" : "dias"}.`
      : "Sua assinatura está em dia. Obrigado pela confiança!";
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
