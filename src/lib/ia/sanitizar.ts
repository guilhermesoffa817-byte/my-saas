/**
 * Limpa texto livre (descrição de despesa, nome de categoria) antes de ele ir
 * para a IA. É a minimização da LGPD (art. 6º, III): a IA precisa saber que é
 * "aluguel de outubro, R$ 1.800,00", e não o CPF de quem recebeu.
 *
 * Tira CPF, CNPJ, e-mail, telefone e chave Pix aleatória, e corta em 200
 * caracteres. Valores ("R$ 1.234,56") e datas ("12/10/2026") passam intactos.
 */

/** Antes e depois do número não pode haver dígito, ponto nem vírgula colados. */
const SEM_DIGITO_ANTES = String.raw`(?<![\d.,/-])`;
const SEM_DIGITO_DEPOIS = String.raw`(?![\d]|[.,/-]\d)`;

const PADROES: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "[e-mail]"],
  // Chave Pix aleatória (formato UUID).
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "[chave]"],
  [
    new RegExp(`${SEM_DIGITO_ANTES}\\d{2}\\.?\\d{3}\\.?\\d{3}\\/?\\d{4}-?\\d{2}${SEM_DIGITO_DEPOIS}`, "g"),
    "[cnpj]",
  ],
  [new RegExp(`${SEM_DIGITO_ANTES}\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}${SEM_DIGITO_DEPOIS}`, "g"), "[cpf]"],
  // Telefone: +55 opcional, DDD com ou sem parênteses, 8 ou 9 dígitos. Sem ponto
  // nem vírgula no meio: é isso que deixa "R$ 1.234,56" em paz.
  [
    new RegExp(
      `${SEM_DIGITO_ANTES}(?:\\+?55[\\s-]?)?(?:\\(\\d{2}\\)|\\d{2})[\\s-]?(?:9[\\s-]?)?\\d{4}[\\s-]?\\d{4}${SEM_DIGITO_DEPOIS}`,
      "g",
    ),
    "[telefone]",
  ],
];

export const LIMITE_PARA_IA = 200;

export function sanitizarParaIA(texto: string) {
  return PADROES.reduce((atual, [padrao, troca]) => atual.replace(padrao, troca), texto).slice(
    0,
    LIMITE_PARA_IA,
  );
}

function escapar(texto: string) {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Ligações de nome composto: sozinhas não identificam ninguém e aparecem em toda frase. */
const PARTICULAS = new Set(["das", "dos", "del", "della", "van", "von", "der"]);

/**
 * Tira o acento de cada caractere sem mudar o tamanho do texto: a posição de
 * cada letra no texto dobrado é a mesma no original. Assim dá para achar o
 * nome sem acento e trocar no texto de verdade.
 */
function dobrarAcentos(texto: string) {
  return Array.from(texto, (caractere) => {
    const base = Array.from(caractere.normalize("NFD"))[0] ?? caractere;
    return base.length === caractere.length ? base : caractere;
  }).join("");
}

/**
 * Troca por "[nome]" cada pedaço (de 3 letras ou mais) dos nomes que o Bossa
 * conhece: clientes, gente da equipe e a própria dona. Uma despesa como
 * "Vale para Rafael Lima" vira "Vale para [nome]". Acento não conta: a dona
 * que digita "Julia" para a cliente "Júlia" também tem o nome escondido.
 *
 * Pode esconder demais (uma cliente de sobrenome "Luz" apaga a palavra em
 * "conta de luz"), e isso é aceitável: as regras já rodaram no texto original,
 * e na dúvida é melhor a IA saber menos do que saber o nome de alguém. Só as
 * ligações ("dos", "das"...) ficam, porque não dizem de quem se trata.
 */
export function ocultarNomes(texto: string, nomes: string[]) {
  const partes = [
    ...new Set(
      nomes.flatMap((nome) =>
        dobrarAcentos(nome.normalize("NFC"))
          .toLowerCase()
          .trim()
          .split(/\s+/)
          .filter((parte) => parte.length >= 3 && !PARTICULAS.has(parte)),
      ),
    ),
  ].sort((a, b) => b.length - a.length);
  if (partes.length === 0) return texto;
  const padrao = new RegExp(
    `(?<![\\p{L}\\p{N}])(?:${partes.map(escapar).join("|")})(?![\\p{L}\\p{N}])`,
    "giu",
  );

  const original = texto.normalize("NFC");
  const dobrado = dobrarAcentos(original);
  let resultado = "";
  let ate = 0;
  for (const achado of dobrado.matchAll(padrao)) {
    const inicio = achado.index ?? 0;
    resultado += original.slice(ate, inicio) + "[nome]";
    ate = inicio + achado[0].length;
  }
  resultado += original.slice(ate);
  return resultado.replace(/\[nome\](\s+\[nome\])+/g, "[nome]");
}
