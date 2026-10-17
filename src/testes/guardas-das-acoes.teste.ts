import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A regra que segura a demonstração, conferida no código.
 *
 * As telas usam as portas de LEITURA, que na demonstração entregam o estúdio de
 * exemplo. As ações ("use server") e as rotas de API usam as portas de
 * ESCRITA, que mandam para a assinatura e devolvem sempre a conta da sessão.
 *
 * Basta uma ação nova usar a porta errada para o estúdio de exemplo, que é o
 * mesmo para todo mundo, poder ser mudado por um visitante. Este teste varre os
 * arquivos e falha antes disso chegar ao ar.
 */

const RAIZ = join(__dirname, "..");

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) return nome === "generated" ? [] : arquivos(caminho);
    return /\.(ts|tsx)$/.test(nome) && !/\.teste\.tsx?$/.test(nome) ? [caminho] : [];
  });
}

/** Tira comentários, para um texto explicando a regra não contar como uso. */
function semComentarios(texto: string) {
  return texto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

function ehUseServer(texto: string) {
  return /^["']use server["'];?/.test(semComentarios(texto).trimStart());
}

const todos = arquivos(RAIZ).map((caminho) => ({
  caminho: relative(RAIZ, caminho).split("\\").join("/"),
  texto: semComentarios(readFileSync(caminho, "utf8")),
  bruto: readFileSync(caminho, "utf8"),
}));

const acoes = todos.filter((arquivo) => ehUseServer(arquivo.bruto));
/**
 * Rotas públicas que não leem sessão nem conta de ninguém. A de saúde só faz
 * "select 1" para o banco do Supabase grátis não pausar (ver
 * .github/workflows/manter-acordado.yml). Toda outra rota passa pela porta.
 */
const ROTAS_PUBLICAS = ["app/api/saude/route.ts"];

const todasAsRotasDeApi = todos.filter((arquivo) => /^app\/api\/.+\/route\.ts$/.test(arquivo.caminho));
const rotasDeApi = todasAsRotasDeApi.filter((arquivo) => !ROTAS_PUBLICAS.includes(arquivo.caminho));
const rotasPublicas = todasAsRotasDeApi.filter((arquivo) => ROTAS_PUBLICAS.includes(arquivo.caminho));

/** O que só pode aparecer nas telas, nunca numa ação ou rota de API. */
const SO_NAS_TELAS: { nome: string; padrao: RegExp }[] = [
  { nome: "exigirLeitura", padrao: /\bexigirLeitura\b/ },
  { nome: "exigirLeituraDoRecurso", padrao: /\bexigirLeituraDoRecurso\b/ },
  { nome: "estudioDeExemplo", padrao: /\b(estudioDeExemplo|refazerEstudioDeExemplo)\b/ },
  { nome: "ID_DO_ESTUDIO_DE_EXEMPLO", padrao: /\bID_DO_ESTUDIO_DE_EXEMPLO\b/ },
  // Ler a sessão por fora das portas pularia a checagem da demonstração.
  { nome: "usuarioAtual", padrao: /\busuarioAtual\b/ },
];

const PORTAS_DE_ESCRITA = /\b(exigirEscrita|exigirEscritaDoRecurso|exigirContaPropria|exigirAdmin)\(/;

describe("as portas das ações e das rotas de API", () => {
  it("encontra os arquivos que deve conferir", () => {
    expect(acoes.length).toBeGreaterThan(10);
    expect(acoes.map((a) => a.caminho)).toContain("app/painel/cobrancas/acoes.ts");
    expect(rotasDeApi.map((a) => a.caminho)).toContain("app/api/assistente/route.ts");
  });

  it("nenhuma ação usa porta de leitura nem a conta de exemplo", () => {
    for (const acao of acoes) {
      for (const proibido of SO_NAS_TELAS) {
        expect(proibido.padrao.test(acao.texto), `${acao.caminho} usa ${proibido.nome}`).toBe(false);
      }
    }
  });

  it("as rotas públicas não leem sessão, conta nem dado de estúdio", () => {
    expect(rotasPublicas.map((a) => a.caminho)).toEqual(ROTAS_PUBLICAS);
    for (const rota of rotasPublicas) {
      expect(/sessao|guardas|usuario|cookies|headers\(/i.test(rota.texto), `${rota.caminho} mexe com conta`).toBe(false);
    }
  });

  it("nenhuma rota de API usa porta de leitura, e todas usam a porta de escrita da API", () => {
    expect(rotasDeApi.length).toBeGreaterThan(0);
    for (const rota of rotasDeApi) {
      for (const proibido of SO_NAS_TELAS) {
        expect(proibido.padrao.test(rota.texto), `${rota.caminho} usa ${proibido.nome}`).toBe(false);
      }
      expect(/\bexigirEscritaNaApi\(/.test(rota.texto), `${rota.caminho} sem exigirEscritaNaApi`).toBe(true);
    }
  });

  it("toda ação exportada do painel passa por uma porta de escrita antes de qualquer coisa", () => {
    const doPainel = acoes.filter((acao) => acao.caminho.startsWith("app/painel/"));
    expect(doPainel.length).toBeGreaterThan(10);

    for (const acao of doPainel) {
      // Cada função exportada, do nome até a próxima declaração no começo de linha.
      const partes = acao.texto.split(/^export /m).slice(1);
      for (const parte of partes) {
        const nome = /^async function (\w+)/.exec(parte)?.[1];
        if (!nome) {
          // "use server" só pode exportar função assíncrona; tipos somem na compilação.
          expect(/^(type|interface) /.test(parte), `${acao.caminho}: export inesperado`).toBe(true);
          continue;
        }
        // Até a próxima função ou constante do arquivo: helpers não exportados ficam de fora.
        const quebra = parte.indexOf("\n");
        const corpo = parte.slice(0, quebra) + parte.slice(quebra).split(/^(?:async )?function |^const /m)[0];
        const usaEscrita = PORTAS_DE_ESCRITA.test(corpo);
        // A única exceção é avisar o Pix: quem está na demonstração precisa conseguir pagar.
        const avisaPix = acao.caminho === "app/painel/assinatura/acoes.ts" && /\bexigirUsuario\(/.test(corpo);
        expect(usaEscrita || avisaPix, `${acao.caminho} → ${nome} sem porta de escrita`).toBe(true);
      }
    }
  });

  it("as telas do painel não usam porta de escrita para ler", () => {
    const telas = todos.filter((arquivo) => /^app\/painel\/.+\/page\.tsx$|^app\/painel\/page\.tsx$/.test(arquivo.caminho));
    expect(telas.length).toBeGreaterThan(10);
    for (const tela of telas) {
      expect(/\bexigirEscrita(DoRecurso|NaApi)?\(/.test(tela.texto), `${tela.caminho} usa porta de escrita`).toBe(false);
    }
  });
});
