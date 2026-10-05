"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icone } from "@/componentes/ui/icones";
import { PRINCIPAIS, SECUNDARIOS, destinosVisiveis, type Destino } from "./itens";

const MAIS: Destino = {
  href: "/painel/mais",
  rotulo: "Mais",
  explicacao: "O resto do Bossa.",
  icone: "mais",
};

function estaAtivo(caminho: string, href: string) {
  if (href === "/painel") return caminho === "/painel";
  if (href === "/painel/mais") {
    // "Mais" acende quando a tela aberta é uma das que moram dentro dele.
    return (
      caminho === "/painel/mais" ||
      SECUNDARIOS.some((item) => caminho.startsWith(item.href))
    );
  }
  return caminho.startsWith(href);
}

type Quem = { admin: boolean; financeiro: boolean };

/**
 * A barra fixa embaixo, do celular, ao alcance do polegar. Cabem cinco itens:
 * os quatro principais e "Mais", que guarda o resto.
 */
export function BarraDeBaixo({ admin, financeiro }: Quem) {
  const caminho = usePathname();
  const principais = destinosVisiveis(PRINCIPAIS, { financeiro, admin });
  const secundarios = destinosVisiveis(SECUNDARIOS, { financeiro, admin });
  const noCelular = [...principais, ...(secundarios.length > 0 ? [MAIS] : [])];

  return (
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-areia-escura/70 bg-superficie/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex">
          {noCelular.map((item) => {
            const ativo = estaAtivo(caminho, item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-[11px] font-semibold transition ${
                    ativo ? "text-terracota" : "text-carvao-suave"
                  }`}
                >
                  <Icone nome={item.icone} className="h-5 w-5" />
                  {item.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
  );
}

/**
 * A mesma lista, em linha, no computador. Sem "Mais": ali o espaço sobra, e
 * esconder destino em menu só faria a pessoa procurar.
 */
export function NavegacaoLarga({ admin, financeiro }: Quem) {
  const caminho = usePathname();
  const noComputador = [
    ...destinosVisiveis(PRINCIPAIS, { financeiro, admin }),
    ...destinosVisiveis(SECUNDARIOS, { financeiro, admin }),
  ];

  return (
      <nav aria-label="Navegação principal">
        <ul className="flex flex-wrap gap-1.5">
          {noComputador.map((item) => {
            const ativo = estaAtivo(caminho, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                    ativo
                      ? "bg-terracota text-acento-texto"
                      : "text-carvao-suave hover:bg-areia/70 hover:text-carvao"
                  }`}
                >
                  <Icone nome={item.icone} className="h-4 w-4" />
                  {item.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
  );
}
