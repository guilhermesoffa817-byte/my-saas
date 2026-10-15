"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icone } from "@/componentes/ui/icones";
import { sair } from "@/app/acoes/autenticacao";
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
 * esconder destino de trabalho em menu só faria a pessoa procurar. Só as telas
 * de cuidar da conta saem da faixa e vão para o menu do nome, onde todo site
 * guarda essas coisas. Sem elas, a faixa cabe numa linha só numa tela comum.
 */
export function NavegacaoLarga({ admin, financeiro }: Quem) {
  const caminho = usePathname();
  const noComputador = [
    ...destinosVisiveis(PRINCIPAIS, { financeiro, admin }),
    ...destinosVisiveis(SECUNDARIOS, { financeiro, admin }).filter((item) => !item.daConta),
  ];

  return (
      <nav aria-label="Navegação principal">
        <ul className="flex flex-wrap gap-1">
          {noComputador.map((item) => {
            const ativo = estaAtivo(caminho, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition ${
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

/**
 * O menu do nome, no canto de cima, só no computador. Guarda a conta, a
 * assinatura e o "Sair". No celular essas mesmas telas moram no "Mais".
 */
export function MenuDaConta({ nome, admin, financeiro }: Quem & { nome: string }) {
  const caminho = usePathname();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  const botao = useRef<HTMLButtonElement>(null);
  const itens = destinosVisiveis(SECUNDARIOS, { financeiro, admin }).filter(
    (item) => item.daConta,
  );
  const algumAtivo = itens.some((item) => estaAtivo(caminho, item.href));

  // Fecha ao tocar fora ou apertar Esc, como qualquer menu que a pessoa conhece.
  useEffect(() => {
    if (!aberto) return;

    function tocouFora(evento: PointerEvent) {
      if (!caixa.current?.contains(evento.target as Node)) setAberto(false);
    }
    function apertouEsc(evento: KeyboardEvent) {
      if (evento.key !== "Escape") return;
      setAberto(false);
      // O foco volta para o botão, e quem navega pelo teclado não se perde.
      botao.current?.focus();
    }

    document.addEventListener("pointerdown", tocouFora);
    document.addEventListener("keydown", apertouEsc);
    return () => {
      document.removeEventListener("pointerdown", tocouFora);
      document.removeEventListener("keydown", apertouEsc);
    };
  }, [aberto]);

  return (
    <div ref={caixa} className="relative">
      <button
        ref={botao}
        type="button"
        aria-expanded={aberto}
        aria-controls="menu-da-conta"
        onClick={() => setAberto((valor) => !valor)}
        className={`flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition ${
          algumAtivo || aberto
            ? "bg-areia text-carvao"
            : "text-carvao-suave hover:bg-areia/70 hover:text-carvao"
        }`}
      >
        <Icone nome="conta" className="h-4 w-4 shrink-0" />
        <span className="max-w-40 truncate">Oi, {nome}</span>
        <Icone
          nome="abrir"
          className={`h-4 w-4 shrink-0 transition-transform ${aberto ? "rotate-180" : ""}`}
        />
      </button>

      <div
        id="menu-da-conta"
        hidden={!aberto}
        className="absolute right-0 z-50 mt-2 w-60 rounded-2xl border border-areia-escura bg-superficie p-1.5 shadow-[0_18px_50px_-24px_rgba(11,18,32,0.55)]"
      >
        <ul>
          {itens.map((item) => {
            const ativo = estaAtivo(caminho, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={ativo ? "page" : undefined}
                  onClick={() => setAberto(false)}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    ativo
                      ? "bg-terracota/10 text-terracota"
                      : "text-carvao hover:bg-areia/70"
                  }`}
                >
                  <Icone nome={item.icone} className="h-4 w-4 shrink-0" />
                  {item.rotulo}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mx-2 my-1.5 border-t border-areia-escura/70" />

        <form action={sair}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-carvao-suave transition hover:bg-areia/70 hover:text-carvao"
          >
            <Icone nome="sair" className="h-4 w-4 shrink-0" />
            Sair da minha conta
          </button>
        </form>
      </div>
    </div>
  );
}
