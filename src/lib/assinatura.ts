import { somarDias } from "@/lib/formato";
import { montarPix } from "@/lib/pix";

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
  números abaixo só servem quando a variável não existe. Os nomes das variáveis
  continuam os antigos (VIP = Completo) para não exigir troca de nome no painel.
*/
function centavosDoAmbiente(nome: string, padrao: number) {
  const valor = Number(process.env[nome]);
  // Variável vazia, com letra ou zerada cairia num plano de graça: usa o padrão.
  return Number.isInteger(valor) && valor > 0 ? valor : padrao;
}

const SIMPLES_MENSAL_CENTAVOS = centavosDoAmbiente("ASSINATURA_VALOR_CENTAVOS", 18900);
const SIMPLES_ANUAL_CENTAVOS = centavosDoAmbiente("ASSINATURA_ANUAL_CENTAVOS", 189000);
const COMPLETO_MENSAL_CENTAVOS = centavosDoAmbiente("ASSINATURA_VIP_CENTAVOS", 32900);
const COMPLETO_ANUAL_CENTAVOS = centavosDoAmbiente("ASSINATURA_VIP_ANUAL_CENTAVOS", 256900);

/**
 * Os códigos são os mesmos de antes ("vip_*" é o Completo). Eles estão gravados
 * nas assinaturas e nos pagamentos de quem já assina: trocar o texto do código
 * mudaria o plano de gente que pagou. Só nome, preço e o que cada um libera mudaram.
 */
export type CodigoPlano = "mensal" | "anual" | "vip_mensal" | "vip_anual";
export type FamiliaDoPlano = "simples" | "completo";

export type Plano = {
  codigo: CodigoPlano;
  nome: string;
  familia: FamiliaDoPlano;
  periodo: string;
  valorCentavos: number;
  dias: number;
  /** Só o Completo libera lembretes, contas, documentos, custos, relatório, equipe e assistente. */
  completo: boolean;
};

export const NOME_DA_FAMILIA: Record<FamiliaDoPlano, string> = {
  simples: "Simples",
  completo: "Completo",
};

export const PLANOS: Record<CodigoPlano, Plano> = {
  mensal: {
    codigo: "mensal",
    nome: "Simples mensal",
    familia: "simples",
    periodo: "por mês",
    valorCentavos: SIMPLES_MENSAL_CENTAVOS,
    dias: DIAS_POR_CICLO,
    completo: false,
  },
  anual: {
    codigo: "anual",
    nome: "Simples anual",
    familia: "simples",
    periodo: "por ano",
    valorCentavos: SIMPLES_ANUAL_CENTAVOS,
    dias: 365,
    completo: false,
  },
  vip_mensal: {
    codigo: "vip_mensal",
    nome: "Completo mensal",
    familia: "completo",
    periodo: "por mês",
    valorCentavos: COMPLETO_MENSAL_CENTAVOS,
    dias: DIAS_POR_CICLO,
    completo: true,
  },
  vip_anual: {
    codigo: "vip_anual",
    nome: "Completo anual",
    familia: "completo",
    periodo: "por ano",
    valorCentavos: COMPLETO_ANUAL_CENTAVOS,
    dias: 365,
    completo: true,
  },
};

/**
 * Quanto o anual economiza em relação a doze mensalidades do mesmo plano.
 *
 * Calculado, nunca escrito à mão: com os preços de hoje o Simples anual sai por
 * dez mensalidades e o Completo anual por cerca de 7,8. Um texto fixo como
 * "2 meses de brinde" ficaria errado para um dos dois, e errado de novo quando
 * o preço mudar no Netlify. Nunca devolve negativo: se alguém configurar o
 * anual mais caro que doze meses, a tela simplesmente não fala em economia.
 */
export function economiaDoAnual(familia: FamiliaDoPlano) {
  const [mensal, anual] =
    familia === "simples"
      ? [PLANOS.mensal, PLANOS.anual]
      : [PLANOS.vip_mensal, PLANOS.vip_anual];
  return Math.max(0, mensal.valorCentavos * 12 - anual.valorCentavos);
}

/** O anual dividido por doze, em centavos, arredondado para baixo: "sai por R$ X ao mês". */
export function mensalDoAnual(familia: FamiliaDoPlano) {
  const anual = familia === "simples" ? PLANOS.anual : PLANOS.vip_anual;
  return Math.floor(anual.valorCentavos / 12);
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

/** As funções do Completo só abrem para quem está com o Completo pago e em dia. */
export function temPlanoCompleto(
  assinatura: AssinaturaParaPlano | null | undefined,
  agora = new Date(),
) {
  if (!assinatura) return false;
  if (assinatura.validaAte.getTime() <= agora.getTime()) return false;
  if (assinatura.status !== "ativa") return false;
  return planoPorCodigo(assinatura.plano).completo;
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
  diasRestantes: number;
  validaAte: Date;
  recado: string;
};

export const RECADO_DA_DEMONSTRACAO =
  "Você está vendo um estúdio de exemplo. Para usar com os seus clientes, escolha um plano.";

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
      validaAte: agora,
      recado: RECADO_DA_DEMONSTRACAO,
    };
  }

  const validaAte = assinatura.validaAte;
  const dentroDoPrazo = validaAte.getTime() > agora.getTime();
  const diasRestantes = Math.max(
    0,
    Math.ceil((validaAte.getTime() - agora.getTime()) / (24 * 60 * 60 * 1000)),
  );

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
      validaAte,
      recado: RECADO_DA_DEMONSTRACAO,
    };
  }

  const status: StatusAssinatura = dentroDoPrazo
    ? (assinatura.status as StatusAssinatura)
    : "expirada";

  const emTeste = status === "teste" && dentroDoPrazo;
  const liberada = dentroDoPrazo && (status === "ativa" || status === "teste");

  return {
    status,
    liberada,
    emTeste,
    demonstracao: false,
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
