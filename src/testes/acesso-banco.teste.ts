import bcrypt from "bcryptjs";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TEM_BANCO, banco, limpar } from "./banco";
import {
  ESPERA_MAXIMA_MS,
  REGRAS,
  esperaDepoisDe,
  registrarSenhaErrada,
} from "@/lib/limite-de-entrada";
import { criarLinkDeSenha, pedidosEsperando, registrarPedidoDeSenha } from "@/lib/pedidos-de-senha";

/**
 * A entrada, a saída e a senha nova com banco de verdade.
 *
 * As ações são as de verdade; só o que o Next faria em volta delas (cookie,
 * cabeçalhos, redirecionamento) é trocado por um arremedo, e o Prisma é o do
 * banco de teste.
 */

class Redirecionou extends Error {
  constructor(public destino: string) {
    super(`redirect: ${destino}`);
  }
}

const pedido = vi.hoisted(() => ({
  ip: "200.150.10.1",
  cookies: new Map<string, string>(),
}));

vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Redirecionou(destino);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": pedido.ip }),
  cookies: async () => ({
    get: (nome: string) =>
      pedido.cookies.has(nome) ? { name: nome, value: pedido.cookies.get(nome) } : undefined,
    set: (nome: string, valor: string) => void pedido.cookies.set(nome, valor),
    delete: (nome: string) => void pedido.cookies.delete(nome),
  }),
}));
// O mesmo cliente do banco de teste, que recusa qualquer endereço que não seja local.
vi.mock("@/lib/prisma", async () => {
  const { banco: abrir } = await import("./banco");
  return { prisma: await abrir() };
});

const SENHA_CERTA = "Ventania de agosto 7";
const COOKIE = "sessao_estudio";

function formulario(campos: Record<string, string>) {
  const dados = new FormData();
  for (const [campo, valor] of Object.entries(campos)) dados.set(campo, valor);
  return dados;
}

async function criarDona(email = "carla@teste.com.br") {
  const db = await banco();
  return db.usuario.create({
    data: {
      nome: "Carla Mendes",
      email,
      // Custo baixo só para o teste andar rápido; a conferência é a mesma.
      senhaHash: await bcrypt.hash(SENHA_CERTA, 4),
      nomeNegocio: "Estúdio Carla",
      telefone: "66992513501",
      assinatura: { create: { status: "demonstracao", validaAte: new Date() } },
    },
  });
}

const acoes = () => import("@/app/acoes/autenticacao");
const acoesDeSenha = () => import("@/app/acoes/senha");

/** Faz o relógio andar sem mexer nos temporizadores de que o Prisma precisa. */
function relogio(inicio: Date) {
  let agora = inicio.getTime();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(agora);
  return (ms: number) => {
    agora += ms;
    vi.setSystemTime(agora);
  };
}

describe("espera crescente", () => {
  it("nenhuma espera até o limite, depois dobra até 15 minutos", () => {
    const livres = REGRAS.email.livres;
    expect(esperaDepoisDe(livres - 1, livres)).toBe(0);
    expect(esperaDepoisDe(livres, livres)).toBe(60_000);
    expect(esperaDepoisDe(livres + 1, livres)).toBe(120_000);
    expect(esperaDepoisDe(livres + 2, livres)).toBe(240_000);
    expect(esperaDepoisDe(livres + 3, livres)).toBe(480_000);
    expect(esperaDepoisDe(livres + 4, livres)).toBe(ESPERA_MAXIMA_MS);
    expect(esperaDepoisDe(livres + 40, livres)).toBe(ESPERA_MAXIMA_MS);
  });
});

describe.skipIf(!TEM_BANCO)("acesso com banco", () => {
  beforeEach(async () => {
    await limpar();
    pedido.ip = "200.150.10.1";
    pedido.cookies.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await limpar();
    await (await banco()).$disconnect();
  });

  describe("entrar", () => {
    it("com a senha errada, devolve o e-mail digitado e nunca a senha", async () => {
      await criarDona();
      const { entrar } = await acoes();
      const resposta = await entrar(null, formulario({ email: "Carla@Teste.com.br", senha: "outra-coisa-9" }));

      expect(resposta?.erro).toContain("não batem");
      expect(resposta?.campos).toEqual({ email: "carla@teste.com.br" });
      expect(JSON.stringify(resposta)).not.toContain("outra-coisa-9");
    });

    it("com a senha certa, entra e grava o cookie", async () => {
      await criarDona();
      const { entrar } = await acoes();
      await expect(
        entrar(null, formulario({ email: "carla@teste.com.br", senha: SENHA_CERTA })),
      ).rejects.toMatchObject({ destino: "/painel" });
      expect(pedido.cookies.get(COOKIE)).toBeTruthy();
    });

    it("muitas senhas erradas para o mesmo e-mail pedem uma espera que cresce, e nem a certa entra durante ela", async () => {
      await criarDona();
      const db = await banco();
      const { entrar } = await acoes();
      const andar = relogio(new Date("2026-10-19T13:00:00Z"));
      const errada = () => entrar(null, formulario({ email: "carla@teste.com.br", senha: "chute-errado-1" }));
      const certa = () => entrar(null, formulario({ email: "carla@teste.com.br", senha: SENHA_CERTA }));

      for (let i = 1; i < REGRAS.email.livres; i++) {
        expect((await errada())?.erro).toBe("E-mail ou senha não batem. Tenta de novo com calma?");
      }
      // A quinta errada já avisa quanto tempo esperar.
      const quinta = await errada();
      expect(quinta?.erro).toContain("daqui a 1 minuto");
      expect(quinta?.erro).toContain("Esqueci minha senha");

      // Durante a espera, nem a senha certa entra, e a tentativa não conta.
      const bloqueada = await certa();
      expect(bloqueada?.erro).toContain("Muitas tentativas");
      expect(bloqueada?.erro).toContain("espere 1 minuto");
      expect(bloqueada?.campos).toEqual({ email: "carla@teste.com.br" });
      expect(pedido.cookies.get(COOKIE)).toBeUndefined();
      expect(await db.tentativaDeEntrada.count()).toBe(REGRAS.email.livres);

      // Passado o minuto, mais uma errada pede o dobro.
      andar(61_000);
      expect((await errada())?.erro).toContain("daqui a 2 minutos");
      andar(30_000);
      expect((await certa())?.erro).toContain("espere 2 minutos");
      andar(91_000);
      expect((await errada())?.erro).toContain("daqui a 4 minutos");

      // Depois da espera, a senha certa entra e as erradas desse e-mail somem.
      andar(4 * 60_000 + 1_000);
      await expect(certa()).rejects.toMatchObject({ destino: "/painel" });
      expect(await db.tentativaDeEntrada.count()).toBe(0);
    });

    it("o freio vale igual para e-mail sem conta, para não contar quem tem conta aqui", async () => {
      const { entrar } = await acoes();
      relogio(new Date("2026-10-19T13:00:00Z"));
      let ultima;
      for (let i = 0; i < REGRAS.email.livres; i++) {
        ultima = await entrar(null, formulario({ email: "ninguem@teste.com.br", senha: "chute-errado-1" }));
      }
      expect(ultima?.erro).toContain("daqui a 1 minuto");
      const depois = await entrar(null, formulario({ email: "ninguem@teste.com.br", senha: "chute-errado-2" }));
      expect(depois?.erro).toContain("Muitas tentativas");
    });

    it("muitas erradas do mesmo IP, em e-mails diferentes, seguram aquele IP e não os outros", async () => {
      await criarDona();
      const { entrar } = await acoes();
      relogio(new Date("2026-10-19T13:00:00Z"));
      pedido.ip = "177.20.30.40";

      let ultima;
      for (let i = 0; i < REGRAS.ip.livres; i++) {
        ultima = await entrar(null, formulario({ email: `alvo${i}@teste.com.br`, senha: "senha-vazada-1" }));
      }
      expect(ultima?.erro).toContain("daqui a 1 minuto");

      // A conta da Carla não errou nada, mas o pedido vem do IP que está varrendo.
      const doMesmoIp = await entrar(null, formulario({ email: "carla@teste.com.br", senha: SENHA_CERTA }));
      expect(doMesmoIp?.erro).toContain("Muitas tentativas");

      pedido.ip = "189.1.2.3";
      await expect(
        entrar(null, formulario({ email: "carla@teste.com.br", senha: SENHA_CERTA })),
      ).rejects.toMatchObject({ destino: "/painel" });
    });

    it("guarda e-mail e IP embaralhados e joga fora as tentativas de mais de um dia", async () => {
      const db = await banco();
      const ontem = new Date("2026-10-18T10:00:00Z");
      await registrarSenhaErrada(db, { emailHash: "a", ipHash: "b" }, ontem);

      const { entrar } = await acoes();
      relogio(new Date("2026-10-19T13:00:00Z"));
      await entrar(null, formulario({ email: "carla@teste.com.br", senha: "chute-errado-1" }));

      const linhas = await db.tentativaDeEntrada.findMany();
      expect(linhas).toHaveLength(1);
      expect(JSON.stringify(linhas)).not.toContain("carla");
      expect(JSON.stringify(linhas)).not.toContain(pedido.ip);
    });
  });

  describe("sair", () => {
    it("encerra a sessão no servidor: uma cópia do cookie não entra mais", async () => {
      const dona = await criarDona();
      const { entrar, sair } = await acoes();
      const { usuarioAtual } = await import("@/lib/sessao");

      await expect(
        entrar(null, formulario({ email: "carla@teste.com.br", senha: SENHA_CERTA })),
      ).rejects.toMatchObject({ destino: "/painel" });
      const copia = pedido.cookies.get(COOKIE) as string;
      expect((await usuarioAtual())?.id).toBe(dona.id);

      await expect(sair()).rejects.toMatchObject({ destino: "/" });
      expect(pedido.cookies.get(COOKIE)).toBeUndefined();

      // Outro aparelho, com o cookie copiado antes de sair.
      pedido.cookies.set(COOKIE, copia);
      expect(await usuarioAtual()).toBeNull();

      // Entrar de novo funciona normalmente.
      pedido.cookies.clear();
      await expect(
        entrar(null, formulario({ email: "carla@teste.com.br", senha: SENHA_CERTA })),
      ).rejects.toMatchObject({ destino: "/painel" });
      expect((await usuarioAtual())?.id).toBe(dona.id);
    });

    it("sair com um cookie velho não derruba a sessão nova", async () => {
      await criarDona();
      const db = await banco();
      const { entrar, sair } = await acoes();
      const { usuarioAtual } = await import("@/lib/sessao");

      await expect(
        entrar(null, formulario({ email: "carla@teste.com.br", senha: SENHA_CERTA })),
      ).rejects.toMatchObject({ destino: "/painel" });
      const velho = pedido.cookies.get(COOKIE) as string;
      await expect(sair()).rejects.toMatchObject({ destino: "/" });

      await expect(
        entrar(null, formulario({ email: "carla@teste.com.br", senha: SENHA_CERTA })),
      ).rejects.toMatchObject({ destino: "/painel" });
      const novo = pedido.cookies.get(COOKIE) as string;

      pedido.cookies.set(COOKIE, velho);
      await expect(sair()).rejects.toMatchObject({ destino: "/" });

      pedido.cookies.set(COOKIE, novo);
      expect(await usuarioAtual()).not.toBeNull();
      expect((await db.usuario.findUniqueOrThrow({ where: { email: "carla@teste.com.br" } })).sessaoVersao).toBe(1);
    });

    it("sair sem cookie não quebra", async () => {
      const { sair } = await acoes();
      await expect(sair()).rejects.toMatchObject({ destino: "/" });
    });
  });

  describe("criar conta", () => {
    const cadastro = {
      nome: "Marina Albuquerque",
      nomeNegocio: "Estúdio Bela Vista",
      email: "marina@estudiobela.com.br",
      telefone: "(66) 99251-3501",
      documento: "123.456.789-00",
      cep: "78000-000",
      endereco: "Rua das Flores, 120, Centro, Cuiabá/MT",
      senha: "Tulipa azul 42",
    };

    it("com erro, devolve tudo o que foi digitado, menos a senha", async () => {
      const { criarConta } = await acoes();
      const resposta = await criarConta(null, formulario(cadastro));

      expect(resposta?.erro).toContain("CPF ou CNPJ");
      const { senha, ...semSenha } = cadastro;
      expect(resposta?.campos).toEqual(semSenha);
      expect(JSON.stringify(resposta)).not.toContain(senha);
    });

    it("recusa senha fácil de adivinhar", async () => {
      const { criarConta } = await acoes();
      const db = await banco();
      for (const senha of ["12345678", "senha123", "abcd1234", "marina2026"]) {
        const resposta = await criarConta(
          null,
          formulario({ ...cadastro, documento: "11.222.333/0001-81", senha }),
        );
        expect(resposta?.erro, senha).toBeTruthy();
        expect(resposta?.campos?.email).toBe(cadastro.email);
      }
      expect(await db.usuario.count()).toBe(0);
    });

    it("recusa WhatsApp impossível", async () => {
      const { criarConta } = await acoes();
      for (const telefone of ["0000000000", "(00) 99251-3501", "(66) 1234-5678"]) {
        const resposta = await criarConta(
          null,
          formulario({ ...cadastro, documento: "11.222.333/0001-81", telefone }),
        );
        expect(resposta?.erro, telefone).toContain("WhatsApp");
        expect(resposta?.campos?.telefone).toBe(telefone);
      }
    });

    it("com tudo certo, cria a conta e entra", async () => {
      const { criarConta } = await acoes();
      await expect(
        criarConta(null, formulario({ ...cadastro, documento: "11.222.333/0001-81" })),
      ).rejects.toMatchObject({ destino: "/painel" });
      expect(pedido.cookies.get(COOKIE)).toBeTruthy();
    });
  });

  describe("pedidos de senha nova", () => {
    it("o pedido fica na fila da administração até alguém gerar o link, por mais tempo que passe", async () => {
      const dona = await criarDona();
      const db = await banco();
      const antes = new Date("2026-10-10T12:00:00Z");

      expect(await registrarPedidoDeSenha(db, dona.id, antes)).toBe(true);
      // Pedir de novo não enche a fila.
      expect(await registrarPedidoDeSenha(db, dona.id, new Date("2026-10-12T12:00:00Z"))).toBe(false);

      const fila = await pedidosEsperando(db);
      expect(fila).toEqual([{ usuarioId: dona.id, criadoEm: antes }]);
    });

    it("pedir de novo depois de um link gerado volta para a fila", async () => {
      const dona = await criarDona();
      const db = await banco();
      await registrarPedidoDeSenha(db, dona.id, new Date("2026-10-19T12:00:00Z"));
      await criarLinkDeSenha(db, dona.id, new Date("2026-10-19T12:05:00Z"));
      expect(await pedidosEsperando(db)).toEqual([]);

      // O link não chegou: ela pede outra vez.
      const { pedirNovaSenha } = await acoesDeSenha();
      const resposta = await pedirNovaSenha(null, formulario({ email: "carla@teste.com.br" }));
      expect(resposta?.recado).toContain("Pedido registrado");
      expect((await pedidosEsperando(db)).map((p) => p.usuarioId)).toEqual([dona.id]);
    });

    it("o recado não promete contato nem prazo, e o e-mail errado volta para o campo", async () => {
      const { pedirNovaSenha } = await acoesDeSenha();
      const certo = await pedirNovaSenha(null, formulario({ email: "ninguem@teste.com.br" }));
      expect(certo?.recado).not.toMatch(/chame a gente|fale com a gente|minutos/i);

      const errado = await pedirNovaSenha(null, formulario({ email: "carla@teste" }));
      expect(errado?.erro).toBeTruthy();
      expect(errado?.campos).toEqual({ email: "carla@teste" });
    });

    it("a senha nova pelo link também recusa senha fácil, sem gastar o link", async () => {
      const dona = await criarDona();
      const db = await banco();
      const codigo = await criarLinkDeSenha(db, dona.id, new Date());
      const { trocarSenha } = await acoesDeSenha();

      const fraca = await trocarSenha(null, formulario({ codigo, senha: "12345678", repetida: "12345678" }));
      expect(fraca?.erro).toBeTruthy();
      const comNome = await trocarSenha(null, formulario({ codigo, senha: "carla2026", repetida: "carla2026" }));
      expect(comNome?.erro).toContain("nome");
      expect(await db.pedidoDeSenha.count({ where: { usadoEm: null } })).toBe(1);

      await expect(
        trocarSenha(null, formulario({ codigo, senha: "Girassol no quintal", repetida: "Girassol no quintal" })),
      ).rejects.toMatchObject({ destino: "/painel" });
      expect((await db.usuario.findUniqueOrThrow({ where: { id: dona.id } })).sessaoVersao).toBe(1);
    });
  });
});
