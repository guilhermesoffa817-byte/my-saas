import Link from "next/link";
import { LinksDeContato } from "@/componentes/contato";
import { Marca } from "@/componentes/marca";
import { BotaoTema } from "@/componentes/tema";
import { canaisDeContato } from "@/lib/contato";
import { FRASE_DA_MARCA } from "@/lib/site";

/**
 * Topo e rodapé das páginas públicas (vendas, privacidade e termos).
 *
 * Ficam aqui para as três páginas mostrarem os mesmos links: privacidade e
 * termos precisam estar a um toque de qualquer página aberta ao público.
 */

export function CabecalhoDoSite() {
  return (
    <header className="mx-auto flex max-w-5xl items-center justify-between gap-2 px-4 py-4 sm:gap-3 sm:px-5 sm:py-5">
      <Marca />
      <nav aria-label="Conta" className="flex items-center gap-1 sm:gap-3">
        <BotaoTema />
        <Link
          href="/entrar"
          className="rounded-xl px-2.5 py-2 text-sm font-semibold whitespace-nowrap text-carvao-suave transition hover:text-terracota sm:px-3"
        >
          Entrar
        </Link>
        {/*
          Não existe teste grátis: quem cria a conta conhece o sistema numa
          demonstração. No celular estreito o texto encolhe para caber numa
          linha só, ao lado de "Entrar".
        */}
        <Link href="/criar-conta" className="botao px-3.5 whitespace-nowrap sm:px-6">
          <span className="sm:hidden">Ver o sistema</span>
          <span className="hidden sm:inline">Conhecer o sistema</span>
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
  const temContato = canaisDeContato().length > 0;

  return (
    <footer className="border-t border-areia-escura/60">
      <div className="mx-auto flex max-w-5xl flex-col gap-5 px-4 py-8 text-sm text-carvao-suave sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <div className="space-y-2">
          <Marca />
          <p>{FRASE_DA_MARCA.charAt(0).toUpperCase() + FRASE_DA_MARCA.slice(1)}.</p>
          {temContato ? (
            <p>
              Fale com a gente: <LinksDeContato className="[&_a]:whitespace-nowrap" />
            </p>
          ) : null}
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
