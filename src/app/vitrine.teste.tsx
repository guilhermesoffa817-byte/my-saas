import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Erro from "./error";
import PaginaInicial, { metadata as metadadosDaInicial } from "./page";
import PaginaPrivacidade from "./privacidade/page";
import PaginaTermos from "./termos/page";

/**
 * A vitrine (página de vendas, termos e privacidade) é montada no build com as
 * variáveis da publicação. Estes testes montam as páginas com o ambiente de
 * cada caso e leem o HTML, do jeito que o cliente lê.
 */

const IA = {
  ANTHROPIC_API_KEY: "chave-de-teste",
  SUPABASE_URL: "https://exemplo.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "chave-de-servico-de-teste",
};
const SEM_IA = { ANTHROPIC_API_KEY: "", SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" };
const CONTATO = { CONTATO_EMAIL: "contato@bossa-teste.com.br", CONTATO_WHATSAPP: "(11) 98765-4321" };
const SEM_CONTATO = { CONTATO_EMAIL: "", CONTATO_WHATSAPP: "" };
const RESPONSAVEL = {
  RESPONSAVEL_NOME: "Marina Albuquerque Serviços Digitais Ltda.",
  RESPONSAVEL_DOCUMENTO: "12.345.678/0001-90",
  ENCARREGADO_DE_DADOS: "Marina Albuquerque",
};
const SEM_RESPONSAVEL = { RESPONSAVEL_NOME: "", RESPONSAVEL_DOCUMENTO: "", ENCARREGADO_DE_DADOS: "" };

function ambiente(...partes: Record<string, string>[]) {
  for (const parte of partes) {
    for (const [nome, valor] of Object.entries(parte)) vi.stubEnv(nome, valor);
  }
}

const PAGINAS = {
  inicial: PaginaInicial,
  termos: PaginaTermos,
  privacidade: PaginaPrivacidade,
};

function html(pagina: keyof typeof PAGINAS) {
  const Pagina = PAGINAS[pagina];
  return renderToStaticMarkup(<Pagina />);
}

/** O texto que aparece na tela, sem tags nem os dados para o Google. */
function texto(pagina: keyof typeof PAGINAS) {
  return html(pagina)
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<\/?(strong|a|span|em)\b[^>]*>/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

/** Qualquer menção a inteligência artificial ou às funções que dependem dela. */
const FALA_DE_IA = [
  /\bIA\b/,
  /intelig[êe]ncia artificial/i,
  /anthropic/i,
  /claude/i,
  /assistente/i,
  /leitura de documentos/i,
  /lid[oa]s? por/i,
];

const RASCUNHO = /\[(REVISAR|EXEMPLO|PREENCHER)|REVISAR COM ADVOGADO|revisão jurídica/i;

const MANDA_CHAMAR = /nos chamar|fale com a gente|pelo contato|contato no fim/i;

beforeEach(() => {
  ambiente(SEM_IA, SEM_CONTATO, SEM_RESPONSAVEL);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("cabeçalho do site", () => {
  it.each(["inicial", "termos", "privacidade"] as const)(
    "%s: não promete teste grátis e chama para conhecer o sistema numa linha só",
    (pagina) => {
      const cabecalho = /<header[\s\S]*?<\/header>/.exec(html(pagina))![0];
      expect(cabecalho).not.toMatch(/gr[áa]tis/i);
      const botao = /<a class="([^"]*)" href="\/criar-conta">(.*?)<\/a>/.exec(cabecalho);
      expect(botao).not.toBeNull();
      expect(botao![1]).toContain("whitespace-nowrap");
      expect(botao![2]).toContain("Conhecer o sistema");
      expect(botao![2]).toContain("Ver o sistema");
    },
  );
});

describe("IA desligada: nada no site, nos termos e na privacidade fala de IA", () => {
  it.each(["inicial", "termos", "privacidade"] as const)("%s", (pagina) => {
    const pedaco = html(pagina);
    for (const padrao of FALA_DE_IA) expect(pedaco).not.toMatch(padrao);
  });
});

describe("IA ligada: os termos e a privacidade contam o que vai para a IA", () => {
  it("termos têm a seção de IA, com as três funções e as franquias", () => {
    ambiente(IA);
    const lido = texto("termos");
    expect(lido).toContain("Inteligência artificial");
    expect(lido).toContain("três funções usam IA");
    expect(lido).toContain("leitura de documentos por IA");
    expect(lido).toMatch(/Assistente: até \d+ perguntas por mês/);
  });

  it("privacidade lista a Anthropic e as funções", () => {
    ambiente(IA);
    const lido = texto("privacidade");
    expect(lido).toContain("Três funções do plano Completo usam o Claude, da Anthropic");
    expect(lido).toContain("Anthropic: a inteligência artificial das funções descritas acima");
    expect(lido).toContain("(Clientes, Equipe, Documentos, Assistente)");
  });

  it("sem o armazenamento de documentos, a leitura some e ficam duas funções", () => {
    ambiente(IA, { SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" });
    expect(texto("termos")).toContain("duas funções usam IA");
    expect(texto("termos")).not.toMatch(/leitura de documentos/i);
    expect(texto("privacidade")).toContain("Duas funções do plano Completo usam o Claude");
    expect(texto("privacidade")).not.toMatch(/Documentos enviados para leitura/);
  });

  it("sem o armazenamento de documentos, a pergunta sobre IA da página de vendas não fala de documentos", () => {
    ambiente(IA, { SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" });
    const pedaco = html("inicial");
    const resposta = /<summary[^>]*>A inteligência artificial vê os meus clientes\?[\s\S]*?<\/details>/.exec(pedaco)![0];
    expect(resposta).toContain("No assistente e na classificação de custos");
    expect(resposta).not.toMatch(/documento/i);
    // Nem nos dados que o Google lê.
    expect(pedaco).not.toMatch(/leitura de documentos/i);
  });

  it("com tudo ligado, a pergunta sobre IA também fala da leitura de documentos", () => {
    ambiente(IA);
    const pedaco = html("inicial");
    const resposta = /<summary[^>]*>A inteligência artificial vê os meus clientes\?[\s\S]*?<\/details>/.exec(pedaco)![0];
    expect(resposta).toContain("Na leitura de documentos, ela lê o arquivo que você enviar.");
  });
});

describe("termos e privacidade sem marcas de rascunho", () => {
  it.each([
    ["sem nada preenchido", [SEM_IA, SEM_CONTATO, SEM_RESPONSAVEL]],
    ["com tudo preenchido", [IA, CONTATO, RESPONSAVEL]],
  ])("%s", (_caso, partes) => {
    ambiente(...partes);
    expect(texto("termos")).not.toMatch(RASCUNHO);
    expect(texto("privacidade")).not.toMatch(RASCUNHO);
  });

  it("os prazos e o foro são os definidos", () => {
    expect(texto("termos")).toContain("antecedência de 30 dias");
    expect(texto("termos")).toContain("Foro: o do domicílio de quem contrata.");
    expect(texto("privacidade")).toContain("apagados em até 30 dias");
    expect(texto("privacidade")).toContain("Respondemos em até 15 dias.");
    expect(texto("privacidade")).toContain("Os servidores ficam em São Paulo.");
  });

  it("sem o responsável no ambiente, a frase some em vez de mostrar um aviso", () => {
    expect(texto("termos")).not.toMatch(/oferecido por/);
    expect(texto("privacidade")).not.toMatch(/oferecido por|Encarregado de dados:/);
  });

  it("com o responsável no ambiente, nome, documento e encarregado aparecem", () => {
    ambiente(RESPONSAVEL);
    expect(texto("termos")).toContain(
      "O Bossa é oferecido por Marina Albuquerque Serviços Digitais Ltda., CPF ou CNPJ 12.345.678/0001-90.",
    );
    expect(texto("privacidade")).toContain("Encarregado de dados: Marina Albuquerque");
  });

  it.each([
    ["só o contato", [CONTATO], "Contato"],
    ["só o encarregado", [{ ENCARREGADO_DE_DADOS: "Marina Albuquerque" }], "Encarregado de dados"],
    ["contato e encarregado", [CONTATO, RESPONSAVEL], "Contato e encarregado de dados"],
    ["só quem oferece", [{ RESPONSAVEL_NOME: "Marina Albuquerque Serviços Digitais Ltda." }], "Quem oferece o Bossa"],
  ])("privacidade: o título da seção de contato diz só o que ela tem (%s)", (_caso, partes, esperado) => {
    ambiente(...partes);
    const titulo = /<h2 id="contato"[^>]*>\d+\. ([^<]+)<\/h2>/.exec(html("privacidade"))![1];
    expect(titulo).toBe(esperado);
  });
});

describe("sumário e títulos das seções batem", () => {
  it.each([
    ["termos", SEM_IA],
    ["termos", IA],
    ["privacidade", SEM_IA],
    ["privacidade", IA],
  ] as const)("%s", (pagina, ia) => {
    ambiente(ia);
    const pedaco = html(pagina);
    const sumario = [...pedaco.matchAll(/<a href="#([^"]+)" class="inline-block[^"]*">([^<]+)<\/a>/g)].map(
      ([, id, titulo]) => [id, titulo],
    );
    const titulos = [...pedaco.matchAll(/<h2 id="([^"]+)"[^>]*>([^<]+)<\/h2>/g)].map(([, id, titulo]) => [id, titulo]);
    expect(sumario.length).toBeGreaterThan(5);
    expect(titulos).toEqual(sumario);
    sumario.forEach(([, titulo], posicao) => expect(titulo.startsWith(`${posicao + 1}. `)).toBe(true));
  });

  it("a seção 4 dos termos fala de demonstração, não de teste", () => {
    expect(texto("termos")).toContain("4. Demonstração, assinatura e garantia");
    expect(texto("termos")).not.toContain("Teste, assinatura");
  });
});

describe("veja também aponta para a outra página", () => {
  it.each([
    ["termos", "/privacidade", "/termos"],
    ["privacidade", "/termos", "/privacidade"],
  ] as const)("%s", (pagina, outra, propria) => {
    const trecho = /Veja também:[\s\S]*?<\/p>/.exec(html(pagina))![0];
    expect(trecho).toContain(`href="${outra}"`);
    expect(trecho).not.toContain(`href="${propria}"`);
  });
});

describe("contato", () => {
  it.each(["inicial", "termos", "privacidade"] as const)(
    "%s: sem canal preenchido, nenhuma frase manda chamar",
    (pagina) => {
      const lido = texto(pagina);
      expect(lido).not.toMatch(MANDA_CHAMAR);
      expect(html(pagina)).not.toMatch(/mailto:|wa\.me/);
    },
  );

  it.each(["inicial", "termos", "privacidade"] as const)(
    "%s: com canal preenchido, o rodapé mostra e-mail e WhatsApp",
    (pagina) => {
      ambiente(CONTATO);
      const rodape = /<footer[\s\S]*<\/footer>/.exec(html(pagina))![0];
      expect(rodape).toContain('href="mailto:contato@bossa-teste.com.br"');
      expect(rodape).toContain('href="https://wa.me/5511987654321"');
    },
  );

  it.each(["termos", "privacidade"] as const)("%s: o contato também fecha a página", (pagina) => {
    ambiente(CONTATO);
    const fim = /<main[\s\S]*<\/main>/.exec(html(pagina))![0];
    expect(fim).toMatch(/id="fale-com-a-gente"[\s\S]*mailto:contato@bossa-teste\.com\.br/);
  });

  it("a tela de erro não manda chamar ninguém: ela é do navegador e não sabe se há canal", () => {
    const lido = renderToStaticMarkup(<Erro error={new Error("teste")} reset={() => {}} />);
    expect(lido).not.toMatch(MANDA_CHAMAR);
    expect(lido).toContain("Tentar de novo");
  });

  it("a garantia nos termos manda para o contato só quando ele existe", () => {
    expect(texto("termos")).toContain("A devolução é feita por Pix para quem pagou.");
    ambiente(CONTATO);
    expect(texto("termos")).toContain("Para pedir, fale com a gente pelo contato no fim desta página");
  });

  it("a pergunta do arrependimento termina com o contato de verdade", () => {
    const sem = texto("inicial");
    expect(sem).toContain("direito de arrependimento do Código de Defesa do Consumidor (art. 49).");
    expect(sem).not.toContain("É só nos chamar");

    ambiente(CONTATO);
    const pedaco = html("inicial");
    const resposta = /<summary[^>]*>E se eu me arrepender depois de pagar\?[\s\S]*?<\/details>/.exec(pedaco)![0];
    expect(resposta).toContain("Para pedir, fale com a gente:");
    expect(resposta).toContain('href="mailto:contato@bossa-teste.com.br"');
    // E o Google lê o mesmo contato, por extenso.
    expect(pedaco).toContain(
      "Para pedir, fale com a gente pelo e-mail contato@bossa-teste.com.br ou pelo WhatsApp (11) 98765-4321.",
    );
  });
});

describe("página de vendas", () => {
  function linhaDoProblema(problema: string) {
    const lista = /O que muda no seu dia[\s\S]*?<\/ul>/.exec(html("inicial"))![0];
    return [...lista.matchAll(/<li[\s\S]*?<\/li>/g)].map(([li]) => li).find((li) => li.includes(problema));
  }

  it("o que é só do Completo leva a etiqueta Completo", () => {
    expect(linhaDoProblema("Conta que vence e você só lembra depois")).toContain("Completo");
    ambiente(IA);
    expect(linhaDoProblema("Papelada acumulada")).toContain("Completo");
  });

  it("o que o Simples resolve não promete custos, que são do Completo", () => {
    const linha = linhaDoProblema("Não sabe quanto sobrou no mês")!;
    expect(linha).not.toContain("Completo");
    expect(linha).not.toMatch(/custos/i);
    expect(linhaDoProblema("Cliente que esquece de pagar")).not.toContain("Completo");
  });

  it("só a página inicial declara o endereço canônico /", () => {
    expect(metadadosDaInicial.alternates?.canonical).toBe("/");
  });
});

describe("tema", () => {
  /**
   * Um componente do servidor que importa um valor de um arquivo "use client"
   * recebe uma referência para o navegador baixar, não o valor. No layout raiz
   * isso fazia o <head> esperar um JavaScript da página e causava o erro de
   * hidratação #418 (ver componentes/script-do-tema.ts).
   */
  it("o layout raiz não importa nada de arquivo \"use client\"", () => {
    const raiz = join(__dirname, "..");
    const layout = readFileSync(join(__dirname, "layout.tsx"), "utf8");
    const internos = [...layout.matchAll(/from "@\/([^"]+)"/g)].map(([, caminho]) => caminho);
    expect(internos.length).toBeGreaterThan(0);
    for (const caminho of internos) {
      const arquivo = [".ts", ".tsx"].map((fim) => join(raiz, caminho + fim)).find(existsSync);
      expect(arquivo, caminho).toBeDefined();
      expect(readFileSync(arquivo!, "utf8").trimStart(), caminho).not.toMatch(/^["']use client["']/);
    }
  });
});
