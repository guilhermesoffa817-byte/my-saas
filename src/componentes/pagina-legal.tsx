import Link from "next/link";
import { LinksDeContato } from "@/componentes/contato";
import { CabecalhoDoSite, RodapeDoSite } from "@/componentes/site";
import { canaisDeContato } from "@/lib/contato";

/**
 * A moldura das páginas de privacidade e de termos.
 *
 * Texto longo pede leitura confortável: coluna estreita, letra de 16px no
 * celular, espaço entre os blocos e um sumário no topo para ir direto ao
 * assunto.
 *
 * Os trechos que ainda pedem revisão jurídica ficam marcados em comentário no
 * código, com "REVISAR COM ADVOGADO", nunca na tela: quem lê a página é o
 * cliente, e o texto que ele vê é o que vale.
 */

export type ItemDoSumario = { id: string; titulo: string };

export type QualPagina = "termos" | "privacidade";

const OUTRA_PAGINA: Record<QualPagina, { href: string; rotulo: string }> = {
  termos: { href: "/privacidade", rotulo: "Política de privacidade" },
  privacidade: { href: "/termos", rotulo: "Termos de uso" },
};

/**
 * O título de cada seção, com o número tirado da posição dela no sumário.
 *
 * Assim o sumário e os títulos não desencontram quando uma seção some (a de
 * inteligência artificial, quando ela está desligada) ou muda de nome: os dois
 * leem o mesmo texto e a mesma posição.
 */
export function numerarSecoes(sumario: ItemDoSumario[]) {
  return (id: string) => {
    const posicao = sumario.findIndex((item) => item.id === id);
    if (posicao < 0) throw new Error(`A seção "${id}" não está no sumário.`);
    return `${posicao + 1}. ${sumario[posicao].titulo}`;
  };
}

export function PaginaLegal({
  pagina,
  titulo,
  atualizadaEm,
  resumo,
  sumario,
  children,
}: {
  pagina: QualPagina;
  titulo: string;
  atualizadaEm: string;
  resumo: React.ReactNode;
  sumario: ItemDoSumario[];
  children: React.ReactNode;
}) {
  const outra = OUTRA_PAGINA[pagina];
  const temContato = canaisDeContato().length > 0;

  return (
    <div className="min-h-screen">
      <CabecalhoDoSite />
      <main className="mx-auto max-w-2xl px-4 pt-6 pb-20 break-words sm:px-5 sm:pt-10">
        <h1 className="font-display text-3xl font-semibold text-balance text-carvao sm:text-4xl">
          {titulo}
        </h1>
        <p className="mt-2 text-sm text-carvao-suave">Última atualização: {atualizadaEm}</p>

        <div className="mt-8 rounded-2xl border border-areia-escura/70 bg-superficie p-5 leading-relaxed text-carvao">
          {resumo}
        </div>

        <nav aria-label="Nesta página" className="mt-8">
          <p className="text-sm font-semibold text-carvao">Nesta página</p>
          <ol className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {sumario.map((item, posicao) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="inline-block py-1 text-terracota underline-offset-4 hover:underline"
                >
                  {posicao + 1}. {item.titulo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-10 space-y-10">{children}</div>

        <div className="mt-12 space-y-2 border-t border-areia-escura/70 pt-6 text-sm text-carvao-suave">
          {temContato ? (
            <p id="fale-com-a-gente">
              Ficou com alguma dúvida? Fale com a gente: <LinksDeContato className="[&_a]:whitespace-nowrap" />.
            </p>
          ) : null}
          <p>
            Veja também:{" "}
            <Link href={outra.href} className="font-semibold text-terracota hover:underline">
              {outra.rotulo}
            </Link>
          </p>
        </div>
      </main>
      <RodapeDoSite />
    </div>
  );
}

export function Secao({
  id,
  titulo,
  children,
}: {
  id: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="scroll-mt-6">
      <h2 id={id} className="font-display text-xl font-semibold text-carvao sm:text-2xl">
        {titulo}
      </h2>
      <div className="mt-3 space-y-3 leading-relaxed text-carvao [&_li]:pl-1 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
