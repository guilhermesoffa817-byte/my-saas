import Link from "next/link";
import { Marca } from "@/componentes/marca";
import { BotaoTema } from "@/componentes/tema";
import { FRASE_DA_MARCA } from "@/lib/site";

/**
 * Topo e rodapé das páginas públicas (vendas, privacidade e termos).
 *
 * Ficam aqui para as três páginas mostrarem os mesmos links: privacidade e
 * termos precisam estar a um toque de qualquer página aberta ao público.
 */

export function CabecalhoDoSite() {
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-5 sm:py-5">
      <Marca />
      <nav aria-label="Conta" className="flex items-center gap-1.5 sm:gap-3">
        <BotaoTema />
        <Link
          href="/entrar"
          className="rounded-xl px-3 py-2 text-sm font-semibold text-carvao-suave transition hover:text-terracota"
        >
          Entrar
        </Link>
        <Link href="/criar-conta" className="botao px-4 sm:px-6">
          Testar grátis
        </Link>
      </nav>
    </header>
  );
}

const LINKS = [
  { href: "/#planos", rotulo: "Planos" },
  { href: "/privacidade", rotulo: "Privacidade" },
  { href: "/termos", rotulo: "Termos de uso" },
  { href: "/entrar", rotulo: "Entrar" },
];

export function RodapeDoSite() {
  return (
    <footer className="border-t border-areia-escura/60">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 text-sm text-carvao-suave sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="space-y-2">
          <Marca />
          <p>{FRASE_DA_MARCA.charAt(0).toUpperCase() + FRASE_DA_MARCA.slice(1)}.</p>
        </div>
        <nav aria-label="Rodapé">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="inline-block py-1 font-medium hover:text-terracota hover:underline">
                  {link.rotulo}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
