/**
 * Equipe: o vocabulário de cada vínculo, a conta do que foi combinado e os
 * avisos que valem conversar com o contador.
 *
 * O Bossa NÃO faz folha de pagamento. Aqui existe só a conta comercial que a
 * dona combinou com cada pessoa (valor fixo, percentual sobre os atendimentos,
 * valor por atendimento), que não é tributo. Salário líquido, encargos, férias
 * e rescisão são com o contador: a dona digita o que pagou.
 *
 * As palavras importam. Registrar "férias", "falta" ou "salário" de quem é
 * parceira ou MEI produz prova de vínculo de emprego contra a própria dona. Por
 * isso cada vínculo tem a sua lista do que aceita, e toda gravação passa por ela.
 *
 * Arquivo sem banco e sem servidor: roda na tela, na ação e nos testes igual.
 * Datas aqui são dia de calendário em texto, "AAAA-MM-DD", sem fuso nenhum.
 */
import { emReais } from "@/lib/formato";
import { ESTAGIO_DURACAO_MAX_MESES, MEI_MAX_EMPREGADOS } from "@/lib/leis";

export const VINCULOS = ["clt", "parceria", "mei", "pj", "autonomo", "estagio"] as const;
export type Vinculo = (typeof VINCULOS)[number];

export const TIPOS_DE_AUSENCIA = [
  "ferias",
  "recesso",
  "folga",
  "atestado",
  "licenca",
  "falta",
  "indisponivel",
] as const;
export type TipoDeAusencia = (typeof TIPOS_DE_AUSENCIA)[number];

export const TIPOS_DE_PAGAMENTO = [
  "salario",
  "comissao",
  "cota_parte",
  "repasse",
  "bolsa",
  "adiantamento",
  "bonus",
  "beneficio",
  "encargo",
  "rescisao",
  "outro",
] as const;
export type TipoDePagamento = (typeof TIPOS_DE_PAGAMENTO)[number];

/** O que vem do formulário ou do banco é texto: estas três conferem antes de confiar. */
export function ehVinculo(valor: unknown): valor is Vinculo {
  return typeof valor === "string" && (VINCULOS as readonly string[]).includes(valor);
}

export function ehTipoDeAusencia(valor: unknown): valor is TipoDeAusencia {
  return typeof valor === "string" && (TIPOS_DE_AUSENCIA as readonly string[]).includes(valor);
}

export function ehTipoDePagamento(valor: unknown): valor is TipoDePagamento {
  return typeof valor === "string" && (TIPOS_DE_PAGAMENTO as readonly string[]).includes(valor);
}

// ---------------------------------------------------------------------------
// Vínculos
// ---------------------------------------------------------------------------

export const SOBRE_O_VINCULO: Record<Vinculo, { rotulo: string; curto: string; descricao: string }> = {
  clt: {
    rotulo: "CLT (carteira assinada)",
    curto: "CLT",
    descricao:
      "Empregada com carteira assinada. Salário líquido, encargos e férias são calculados pelo contador.",
  },
  parceria: {
    rotulo: "Profissional-parceira (Lei do Salão-Parceiro)",
    curto: "Parceria",
    descricao:
      "Lei 12.592/2012, com a redação da Lei 13.352/2016. Pede contrato escrito e homologado; a profissional recebe a cota-parte combinada.",
  },
  mei: {
    rotulo: "MEI prestadora de serviço",
    curto: "MEI",
    descricao: "Presta serviço com o próprio CNPJ de MEI, por contrato de prestação de serviço.",
  },
  pj: {
    rotulo: "Empresa prestadora (PJ)",
    curto: "PJ",
    descricao: "Empresa que presta serviço ao seu negócio e emite nota fiscal pelo que recebe.",
  },
  autonomo: {
    rotulo: "Autônoma (pessoa física)",
    curto: "Autônoma",
    descricao:
      "Pessoa física que presta serviço sem vínculo de emprego. As retenções ficam com o contador.",
  },
  estagio: {
    rotulo: "Estágio",
    curto: "Estágio",
    descricao: "Lei 11.788/2008: termo de compromisso com a escola e bolsa-auxílio.",
  },
};

// ---------------------------------------------------------------------------
// O que foi combinado, com as palavras de cada vínculo
// ---------------------------------------------------------------------------

export type CampoDoCombinado = { rotulo: string; ajuda: string };

export type TermosDoVinculo = {
  /** Valor fixo do mês (salarioCentavos). */
  fixo: CampoDoCombinado | null;
  /** Percentual sobre os atendimentos (comissaoPontosBase). */
  percentual: CampoDoCombinado | null;
  /** Valor por atendimento concluído (porAtendimentoCentavos). */
  porAtendimento: CampoDoCombinado | null;
};

const ACORDO_DE_PRESTADORA: TermosDoVinculo = {
  fixo: null,
  percentual: {
    rotulo: "Percentual combinado",
    ajuda: "Sobre o valor dos atendimentos concluídos por essa pessoa no mês.",
  },
  porAtendimento: {
    rotulo: "Valor por atendimento",
    ajuda: "Valor combinado para cada atendimento concluído.",
  },
};

export const TERMOS_POR_VINCULO: Record<Vinculo, TermosDoVinculo> = {
  clt: {
    fixo: {
      rotulo: "Salário",
      ajuda: "Salário bruto do contrato. O líquido e os encargos vêm do contador.",
    },
    percentual: {
      rotulo: "Comissão",
      ajuda: "Percentual sobre o valor dos atendimentos concluídos por essa pessoa.",
    },
    porAtendimento: null,
  },
  parceria: {
    fixo: null,
    percentual: {
      rotulo: "Cota-parte da profissional",
      ajuda:
        "Percentual de cada atendimento que fica com a profissional-parceira, como está no contrato.",
    },
    porAtendimento: null,
  },
  mei: ACORDO_DE_PRESTADORA,
  pj: ACORDO_DE_PRESTADORA,
  autonomo: ACORDO_DE_PRESTADORA,
  estagio: {
    fixo: {
      rotulo: "Bolsa-auxílio",
      ajuda: "Valor mensal previsto no termo de compromisso de estágio.",
    },
    percentual: null,
    porAtendimento: null,
  },
};

export type Combinado = {
  salarioCentavos: number;
  comissaoPontosBase: number;
  porAtendimentoCentavos: number;
};

/** Zera o que não existe no vínculo: quem passa de CLT para parceria não leva salário junto. */
export function combinadoDoVinculo(vinculo: Vinculo, valores: Combinado): Combinado {
  const termos = TERMOS_POR_VINCULO[vinculo];
  return {
    salarioCentavos: termos.fixo ? valores.salarioCentavos : 0,
    comissaoPontosBase: termos.percentual ? valores.comissaoPontosBase : 0,
    porAtendimentoCentavos: termos.porAtendimento ? valores.porAtendimentoCentavos : 0,
  };
}

/** "Salário R$ 1.900,00 + comissão 10%", "Cota-parte da profissional 60%", "R$ 25,00 por atendimento". */
export function resumirCombinado(vinculo: Vinculo, valores: Combinado) {
  const termos = TERMOS_POR_VINCULO[vinculo];
  const partes: { rotulo: string; valor: string }[] = [];
  if (termos.fixo && valores.salarioCentavos > 0) {
    partes.push({ rotulo: termos.fixo.rotulo, valor: emReais(valores.salarioCentavos) });
  }
  if (termos.percentual && valores.comissaoPontosBase > 0) {
    partes.push({
      rotulo: termos.percentual.rotulo,
      valor: formatarPercentual(valores.comissaoPontosBase),
    });
  }
  if (termos.porAtendimento && valores.porAtendimentoCentavos > 0) {
    partes.push({ rotulo: "", valor: `${emReais(valores.porAtendimentoCentavos)} por atendimento` });
  }
  if (partes.length === 0) return "Nada combinado ainda";
  return partes
    .map(({ rotulo, valor }, posicao) => {
      if (!rotulo) return valor;
      const texto = posicao === 0 ? rotulo : rotulo.charAt(0).toLowerCase() + rotulo.slice(1);
      return `${texto} ${valor}`;
    })
    .join(" + ");
}

// ---------------------------------------------------------------------------
// Ausências e pagamentos que cada vínculo aceita
// ---------------------------------------------------------------------------

/**
 * Estágio tem recesso, nunca férias. Quem não é empregada só fica
 * "indisponível": falta e folga de prestadora são sinal de subordinação.
 */
export const AUSENCIAS_POR_VINCULO: Record<Vinculo, TipoDeAusencia[]> = {
  clt: ["ferias", "folga", "atestado", "licenca", "falta"],
  estagio: ["recesso", "folga", "atestado", "falta"],
  parceria: ["indisponivel"],
  mei: ["indisponivel"],
  pj: ["indisponivel"],
  autonomo: ["indisponivel"],
};

/** Parceria recebe cota-parte; MEI, PJ e autônoma recebem repasse. Salário é só de CLT. */
export const PAGAMENTOS_POR_VINCULO: Record<Vinculo, TipoDePagamento[]> = {
  clt: ["salario", "comissao", "adiantamento", "bonus", "beneficio", "encargo", "rescisao", "outro"],
  estagio: ["bolsa", "beneficio", "outro"],
  parceria: ["cota_parte", "outro"],
  mei: ["repasse", "outro"],
  pj: ["repasse", "outro"],
  autonomo: ["repasse", "outro"],
};

export const ROTULO_DA_AUSENCIA: Record<TipoDeAusencia, string> = {
  ferias: "Férias",
  recesso: "Recesso",
  folga: "Folga",
  atestado: "Atestado",
  licenca: "Licença",
  falta: "Falta",
  indisponivel: "Indisponível na agenda",
};

export const ROTULO_DO_PAGAMENTO: Record<TipoDePagamento, string> = {
  salario: "Salário",
  comissao: "Comissão",
  cota_parte: "Cota-parte",
  repasse: "Repasse do valor combinado",
  bolsa: "Bolsa-auxílio",
  adiantamento: "Adiantamento",
  bonus: "Bônus",
  beneficio: "Benefício (transporte, alimentação)",
  encargo: "Guia de encargos",
  rescisao: "Rescisão",
  outro: "Outro",
};

/** A palavra que abre a descrição do lançamento nas Finanças. Curta, sem parênteses. */
const ROTULO_NO_LANCAMENTO: Record<TipoDePagamento, string> = {
  salario: "Salário",
  comissao: "Comissão",
  cota_parte: "Cota-parte",
  repasse: "Repasse",
  bolsa: "Bolsa-auxílio",
  adiantamento: "Adiantamento",
  bonus: "Bônus",
  beneficio: "Benefício",
  encargo: "Encargos",
  rescisao: "Rescisão",
  outro: "Pagamento",
};

export function ausenciaPermitida(vinculo: Vinculo, tipo: TipoDeAusencia) {
  return AUSENCIAS_POR_VINCULO[vinculo].includes(tipo);
}

export function pagamentoPermitido(vinculo: Vinculo, tipo: TipoDePagamento) {
  return PAGAMENTOS_POR_VINCULO[vinculo].includes(tipo);
}

const VINCULOS_SEM_EMPREGO: Vinculo[] = ["parceria", "mei", "pj", "autonomo"];

/** De CLT ou estágio para parceria, MEI, PJ ou autônoma. Estágio para CLT é efetivação: livre. */
export function trocaParaVinculoSemEmprego(de: Vinculo, para: Vinculo) {
  return de !== para && !VINCULOS_SEM_EMPREGO.includes(de) && VINCULOS_SEM_EMPREGO.includes(para);
}

/**
 * A troca que não pode acontecer: virar "PJ com férias registradas" é a prova
 * de emprego que o vocabulário existe para evitar. Só recusa quando já há
 * histórico de emprego; um cadastro feito errado e sem nada registrado ainda
 * pode ser corrigido.
 */
export function trocaDeVinculoRecusada(
  de: Vinculo,
  para: Vinculo,
  historico: { ausencias: string[]; pagamentos: string[] },
) {
  if (de === para || !VINCULOS_SEM_EMPREGO.includes(para)) return false;
  const ausenciaDeEmprego = historico.ausencias.some((tipo) => tipo !== "indisponivel");
  const pagamentoDeEmprego = historico.pagamentos.some(
    (tipo) => !["cota_parte", "repasse", "outro"].includes(tipo),
  );
  return ausenciaDeEmprego || pagamentoDeEmprego;
}

export const TROCA_DE_VINCULO_RECUSADA =
  "Essa pessoa já tem férias, faltas, salário ou outro registro de emprego, então o vínculo não pode virar parceria, MEI, PJ ou autônoma. Registre o desligamento deste cadastro e cadastre a pessoa de novo, com o vínculo novo.";

/** O tipo que já vem marcado ao registrar um pagamento. */
export function tipoDePagamentoSugerido(vinculo: Vinculo, valores: Combinado): TipoDePagamento {
  switch (vinculo) {
    case "clt":
      return valores.salarioCentavos === 0 && valores.comissaoPontosBase > 0 ? "comissao" : "salario";
    case "estagio":
      return "bolsa";
    case "parceria":
      return "cota_parte";
    default:
      return "repasse";
  }
}

export const CATEGORIA_SALARIOS = "Salários e encargos";
export const CATEGORIA_COMISSOES = "Comissões e repasses";

/** Em que categoria de despesa o pagamento entra nas Finanças. */
export function categoriaDoPagamento(tipo: TipoDePagamento) {
  return tipo === "comissao" || tipo === "cota_parte" || tipo === "repasse"
    ? CATEGORIA_COMISSOES
    : CATEGORIA_SALARIOS;
}

/** "Juliana Prado" → "Juliana P.". A descrição do lançamento nunca leva sobrenome inteiro nem CPF. */
export function nomeCurto(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes[0]} ${partes[partes.length - 1].charAt(0).toUpperCase()}.`;
}

export const NOME_DE_QUEM_SAIU = "Ex-colaborador";

/** "Cota-parte — Juliana P.". Depois da remoção, "Cota-parte — Ex-colaborador". */
export function descricaoDoLancamento(tipo: TipoDePagamento, nome: string | null) {
  return `${ROTULO_NO_LANCAMENTO[tipo]} — ${nome ? nomeCurto(nome) : NOME_DE_QUEM_SAIU}`;
}

// ---------------------------------------------------------------------------
// Percentual em pontos-base (10000 = 100%), sem número quebrado
// ---------------------------------------------------------------------------

/** Valor × percentual, arredondado ao centavo. 4000 pontos-base = 40%. */
export function aplicarPercentual(valorCentavos: number, pontosBase: number) {
  return Math.round((valorCentavos * pontosBase) / 10_000);
}

/**
 * Lê o percentual digitado só mexendo no texto, sem passar por número
 * quebrado: "40" → 4000, "40,5" → 4050, "12,25%" → 1225. Vazio vale zero.
 * Devolve null quando não é um percentual de 0 a 100 com até duas casas.
 */
export function textoParaPontosBase(texto: string): number | null {
  const limpo = texto.replace(/\s/g, "").replace(/%$/, "");
  if (limpo === "") return 0;
  const partes = /^(\d{1,3})(?:[.,](\d{0,2}))?$/.exec(limpo);
  if (!partes) return null;
  const inteiro = Number(partes[1]);
  const casas = Number((partes[2] ?? "").padEnd(2, "0"));
  const pontos = inteiro * 100 + casas;
  return pontos > 10_000 ? null : pontos;
}

/** 4050 → "40,5"; 4000 → "40"; 1225 → "12,25"; 5 → "0,05". */
export function pontosBaseParaTexto(pontosBase: number) {
  const inteiro = Math.trunc(pontosBase / 100);
  const resto = pontosBase % 100;
  if (resto === 0) return String(inteiro);
  return `${inteiro},${String(resto).padStart(2, "0").replace(/0$/, "")}`;
}

export function formatarPercentual(pontosBase: number) {
  return `${pontosBaseParaTexto(pontosBase)}%`;
}

/** 190050 → "1900,50", para devolver um valor ao campo sem passar por número quebrado. */
export function centavosParaCampo(centavos: number) {
  if (centavos <= 0) return "";
  return `${Math.trunc(centavos / 100)},${String(centavos % 100).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Valor sugerido do mês
// ---------------------------------------------------------------------------

export type ValorSugerido = {
  fixoCentavos: number;
  percentualCentavos: number;
  porAtendimentoCentavos: number;
  totalCentavos: number;
};

export type BaseDoMes = {
  /** Soma do preço dos atendimentos concluídos pela pessoa no mês. */
  baseCentavos: number;
  /** Quantos atendimentos ela concluiu no mês. */
  atendimentos: number;
};

/**
 * A conta do combinado no mês: fixo + percentual × base + por atendimento ×
 * quantidade. Não desconta nem soma tributo nenhum: isso é com o contador.
 */
export function valorSugeridoDoMes(valores: Combinado & BaseDoMes): ValorSugerido {
  const fixoCentavos = valores.salarioCentavos;
  const percentualCentavos = aplicarPercentual(valores.baseCentavos, valores.comissaoPontosBase);
  const porAtendimentoCentavos = valores.porAtendimentoCentavos * valores.atendimentos;
  return {
    fixoCentavos,
    percentualCentavos,
    porAtendimentoCentavos,
    totalCentavos: fixoCentavos + percentualCentavos + porAtendimentoCentavos,
  };
}

/** A sugestão de uma pessoa, já com o combinado limpo pelo vínculo. */
export function sugestaoDoColaborador(
  colaborador: Combinado & { vinculo: Vinculo },
  base: BaseDoMes | undefined,
): ValorSugerido {
  return valorSugeridoDoMes({
    ...combinadoDoVinculo(colaborador.vinculo, colaborador),
    baseCentavos: base?.baseCentavos ?? 0,
    atendimentos: base?.atendimentos ?? 0,
  });
}

/**
 * O valor que já vem no campo ao registrar o pagamento, conforme o tipo.
 * Salário e bolsa puxam o fixo; comissão, o percentual; cota-parte e repasse,
 * o percentual mais o valor por atendimento. Adiantamento, bônus, benefício,
 * encargos e rescisão não têm conta combinada: vem vazio, a dona digita.
 */
export function valorDoTipoDePagamento(tipo: TipoDePagamento, sugerido: ValorSugerido) {
  switch (tipo) {
    case "salario":
    case "bolsa":
      return sugerido.fixoCentavos;
    case "comissao":
      return sugerido.percentualCentavos;
    case "cota_parte":
    case "repasse":
      return sugerido.percentualCentavos + sugerido.porAtendimentoCentavos;
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Datas de calendário, "AAAA-MM-DD", e meses, "AAAA-MM"
// ---------------------------------------------------------------------------

const MES = /^\d{4}-(0[1-9]|1[0-2])$/;

export function competenciaValida(texto: unknown): texto is string {
  return typeof texto === "string" && MES.test(texto);
}

/** Soma meses a um dia, encostando no último dia quando ele não existe (31/01 + 1 → 28/02). */
export function somarMeses(dia: string, meses: number) {
  const [ano, mes, diaDoMes] = dia.split("-").map(Number);
  const indice = ano * 12 + (mes - 1) + meses;
  const novoAno = Math.floor(indice / 12);
  const novoMes = (indice % 12) + 1;
  const ultimoDia = new Date(Date.UTC(novoAno, novoMes, 0)).getUTCDate();
  const novoDia = Math.min(diaDoMes, ultimoDia);
  return `${String(novoAno).padStart(4, "0")}-${String(novoMes).padStart(2, "0")}-${String(novoDia).padStart(2, "0")}`;
}

/** Soma meses a um mês "AAAA-MM". */
export function somarMesesACompetencia(mes: string, meses: number) {
  return somarMeses(`${mes}-01`, meses).slice(0, 7);
}

/** Primeiro e último dia de um mês "AAAA-MM". */
export function limitesDoMes(mes: string) {
  const [ano, numero] = mes.split("-").map(Number);
  const ultimo = new Date(Date.UTC(ano, numero, 0)).getUTCDate();
  return { de: `${mes}-01`, ate: `${mes}-${String(ultimo).padStart(2, "0")}` };
}

/** Quantos dias o período cobre, contando o primeiro e o último. */
export function diasNoPeriodo(inicio: string, fim: string) {
  const [a1, m1, d1] = inicio.split("-").map(Number);
  const [a2, m2, d2] = fim.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000) + 1;
}

type Periodo = { inicio: string; fim: string | null };

/** Trabalhando hoje: já começou e ainda não terminou (o último dia ainda conta). */
export function estaAtivo(periodo: Periodo, hoje: string) {
  return periodo.inicio <= hoje && (periodo.fim === null || periodo.fim >= hoje);
}

/** Trabalhou em algum dia do mês "AAAA-MM". */
export function ativoNoMes(periodo: Periodo, mes: string) {
  const { de, ate } = limitesDoMes(mes);
  return periodo.inicio <= ate && (periodo.fim === null || periodo.fim >= de);
}

/** Uma ausência cobre o dia? Os dois extremos contam. */
export function ausenteNoDia(ausencia: { inicio: string; fim: string }, dia: string) {
  return ausencia.inicio <= dia && ausencia.fim >= dia;
}

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

export type AlertaDaEquipe = {
  chave: string;
  nivel: "atencao" | "lembrete";
  titulo: string;
  texto: string;
};

export type ColaboradorParaAlerta = Periodo & {
  id: string;
  nome: string;
  vinculo: Vinculo;
  removido?: boolean;
};

/**
 * O que a dona precisa ver. Nenhum aviso decide nada nem avalia a pessoa: só
 * apontam o que conferir com o contador, a partir do cadastro.
 *
 * `ehMei` vem null quando o Bossa não sabe o regime do negócio. Nesse caso o
 * aviso do MEI vira lembrete condicional, em vez de afirmar o que não sabe.
 */
export function alertasDaEquipe({
  ehMei,
  hoje,
  colaboradores,
}: {
  ehMei: boolean | null;
  hoje: string;
  colaboradores: ColaboradorParaAlerta[];
}): AlertaDaEquipe[] {
  const ativos = colaboradores.filter((c) => !c.removido && estaAtivo(c, hoje));
  const alertas: AlertaDaEquipe[] = [];

  const empregadas = ativos.filter((c) => c.vinculo === "clt").length;
  if (ehMei !== false && empregadas > MEI_MAX_EMPREGADOS) {
    alertas.push(
      ehMei
        ? {
            chave: "mei-empregados",
            nivel: "atencao",
            titulo: "Mais empregadas do que o MEI permite",
            texto: `O MEI pode ter no máximo ${MEI_MAX_EMPREGADOS} empregado com carteira assinada (LC 123/2006, art. 18-C). Há ${empregadas} pessoas ativas como CLT. Converse com seu contador.`,
          }
        : {
            chave: "mei-empregados",
            nivel: "lembrete",
            titulo: "Se o seu negócio é MEI, confira a equipe",
            texto: `O MEI pode ter no máximo ${MEI_MAX_EMPREGADOS} empregado com carteira assinada (LC 123/2006, art. 18-C), e há ${empregadas} pessoas ativas como CLT. Se for o seu caso, converse com seu contador.`,
          },
    );
  }

  for (const estagiaria of ativos.filter((c) => c.vinculo === "estagio")) {
    const limite = somarMeses(estagiaria.inicio, ESTAGIO_DURACAO_MAX_MESES);
    if (hoje > limite) {
      alertas.push({
        chave: `estagio-${estagiaria.id}`,
        nivel: "atencao",
        titulo: `O estágio de ${estagiaria.nome} passou do prazo`,
        texto: `Estágio na mesma empresa dura no máximo ${ESTAGIO_DURACAO_MAX_MESES} meses (Lei 11.788/2008, art. 11), salvo estagiário com deficiência. Converse com seu contador sobre encerrar ou contratar.`,
      });
    }
  }

  if (ativos.some((c) => c.vinculo === "parceria")) {
    alertas.push({
      chave: "parceria-contrato",
      nivel: "lembrete",
      titulo: "Parceria pede contrato escrito e homologado",
      texto:
        "A Lei 13.352/2016 pede contrato escrito, homologado pelo sindicato da categoria (ou pelo órgão local do Ministério do Trabalho) e assinado diante de duas testemunhas. Sem ele, a parceria pode ser tratada como emprego.",
    });
    alertas.push({
      chave: "parceria-receita",
      nivel: "lembrete",
      titulo: "Cota-parte e receita bruta",
      texto:
        "Nas Finanças, o Bossa conta o valor inteiro de cada atendimento concluído como entrada. Confira com seu contador como a cota-parte da profissional-parceira entra na receita bruta do salão.",
    });
  }

  return alertas;
}
