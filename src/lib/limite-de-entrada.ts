/**
 * O freio da tela de entrada.
 *
 * Quem tenta adivinhar a senha de alguém erra muitas vezes seguidas. Cada
 * senha errada vira uma linha em TentativaDeEntrada, com o e-mail e o IP
 * embaralhados. Antes de conferir a senha, a entrada conta essas linhas:
 *
 * - por e-mail: as primeiras erradas do dia passam sem espera. Depois, cada
 *   nova errada pede uma espera que dobra (1, 2, 4, 8 minutos) até 15;
 * - por IP: a mesma regra, com mais folga e contando só a última hora, porque
 *   um salão inteiro ou uma operadora de celular pode sair pelo mesmo IP.
 *
 * Durante a espera nem a senha certa entra: senão o freio não seguraria quem
 * está tentando. A senha certa apaga as erradas daquele e-mail; as do IP
 * ficam, para que entrar na própria conta não zere a conta de quem varre
 * e-mails alheios.
 */
import type { PrismaClient } from "@/generated/prisma";

type Banco = Pick<PrismaClient, "tentativaDeEntrada">;

const UM_MINUTO_MS = 60 * 1000;
const UMA_HORA_MS = 60 * UM_MINUTO_MS;
const UM_DIA_MS = 24 * UMA_HORA_MS;

export const REGRAS = {
  email: { livres: 5, janelaMs: UM_DIA_MS },
  ip: { livres: 20, janelaMs: UMA_HORA_MS },
} as const;

export const ESPERA_INICIAL_MS = UM_MINUTO_MS;
export const ESPERA_MAXIMA_MS = 15 * UM_MINUTO_MS;

export type Chaves = { emailHash: string; ipHash: string };

export type Situacao = { liberado: true } | { liberado: false; liberaEm: Date };

/** Quanto esperar depois de `erradas` senhas erradas, com `livres` sem espera. */
export function esperaDepoisDe(erradas: number, livres: number) {
  if (erradas < livres) return 0;
  return Math.min(ESPERA_INICIAL_MS * 2 ** (erradas - livres), ESPERA_MAXIMA_MS);
}

async function liberaEmPor(
  db: Banco,
  onde: { emailHash: string } | { ipHash: string },
  regra: { livres: number; janelaMs: number },
  agora: Date,
) {
  const resumo = await db.tentativaDeEntrada.aggregate({
    where: { ...onde, criadoEm: { gt: new Date(agora.getTime() - regra.janelaMs) } },
    _count: { _all: true },
    _max: { criadoEm: true },
  });
  const ultima = resumo._max.criadoEm;
  if (!ultima) return null;
  const espera = esperaDepoisDe(resumo._count._all, regra.livres);
  return espera > 0 ? new Date(ultima.getTime() + espera) : null;
}

/** Diz se esse e-mail, desse IP, pode tentar agora, e até quando espera se não puder. */
export async function situacaoDaEntrada(db: Banco, chaves: Chaves, agora: Date): Promise<Situacao> {
  const [peloEmail, peloIp] = await Promise.all([
    liberaEmPor(db, { emailHash: chaves.emailHash }, REGRAS.email, agora),
    liberaEmPor(db, { ipHash: chaves.ipHash }, REGRAS.ip, agora),
  ]);
  const liberaEm = [peloEmail, peloIp]
    .filter((data): data is Date => data !== null && data.getTime() > agora.getTime())
    .sort((a, b) => b.getTime() - a.getTime())[0];
  return liberaEm ? { liberado: false, liberaEm } : { liberado: true };
}

/** Guarda uma senha errada e aproveita para jogar fora as de mais de um dia. */
export async function registrarSenhaErrada(db: Banco, chaves: Chaves, agora: Date) {
  await db.tentativaDeEntrada.create({ data: { ...chaves, criadoEm: agora } });
  try {
    await db.tentativaDeEntrada.deleteMany({
      where: { criadoEm: { lt: new Date(agora.getTime() - UM_DIA_MS) } },
    });
  } catch {
    // Faxina que falha hoje é feita na próxima senha errada.
  }
}

/** A senha certa entrou: as erradas desse e-mail não contam mais. */
export async function esquecerErradasDoEmail(db: Banco, emailHash: string) {
  await db.tentativaDeEntrada.deleteMany({ where: { emailHash } });
}

/** "1 minuto", "2 minutos": sempre arredondado para cima, nunca "0 minutos". */
export function tempoDeEspera(liberaEm: Date, agora: Date) {
  const minutos = Math.max(1, Math.ceil((liberaEm.getTime() - agora.getTime()) / UM_MINUTO_MS));
  return minutos === 1 ? "1 minuto" : `${minutos} minutos`;
}
