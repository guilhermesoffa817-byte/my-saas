import Link from "next/link";
import { CabecalhoDoSite, RodapeDoSite } from "@/componentes/site";

/**
 * A moldura das páginas de privacidade e de termos.
 *
 * Texto longo pede leitura confortável: coluna estreita, letra de 16px no
 * celular, espaço entre os blocos e um sumário no topo para ir direto ao
 * assunto. As marcas [REVISAR COM ADVOGADO] e [PREENCHER] ficam visíveis de
 * propósito, para ninguém publicar a versão final sem a revisão.
 */

export type ItemDoSumario = { id: string; titulo: string };

export function PaginaLegal({
  titulo,
  atualizadaEm,
  resumo,
  sumario,
  children,
}: {
  titulo: string;
  atualizadaEm: string;
  resumo: React.ReactNode;
  sumario: ItemDoSumario[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <CabecalhoDoSite />
      <main className="mx-auto max-w-2xl px-4 pt-6 pb-20 break-words sm:px-5 sm:pt-10">
        <h1 className="font-display text-3xl font-semibold text-balance text-carvao sm:text-4xl">
          {titulo}
        </h1>
        <p className="mt-2 text-sm text-carvao-suave">
          Última atualização: {atualizadaEm} · Versão em revisão jurídica
        </p>

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

        <p className="mt-12 border-t border-areia-escura/70 pt-6 text-sm text-carvao-suave">
          Veja também:{" "}
          <Link href="/privacidade" className="font-semibold text-terracota hover:underline">
            Política de privacidade
          </Link>{" "}
          ·{" "}
          <Link href="/termos" className="font-semibold text-terracota hover:underline">
            Termos de uso
          </Link>
        </p>
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

/** A marca de trecho que precisa passar pelo advogado antes de valer. */
export function Revisar({ children = "REVISAR COM ADVOGADO" }: { children?: React.ReactNode }) {
  return (
    <span className="rounded bg-areia px-1.5 py-0.5 text-xs font-semibold [overflow-wrap:anywhere] text-carvao-suave [box-decoration-break:clone]">
      [{children}]
    </span>
  );
}
