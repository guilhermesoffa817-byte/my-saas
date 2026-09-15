"use client";

import { useState } from "react";
import { BotaoWhatsApp } from "./botao-whatsapp";
import { ITENS_MENU, NEGOCIO } from "./dados";
import { IconeFechar, IconeMenu } from "./icones";

export function Cabecalho() {
  const [menuAberto, definirMenuAberto] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-zinc-950/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <a href="#topo" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500 text-base font-black text-emerald-950">
            RS
          </span>
          <span className="leading-tight">
            <span className="block text-base font-bold text-white">{NEGOCIO.nome}</span>
            <span className="block text-xs text-zinc-400">
              Automação de WhatsApp · {NEGOCIO.cidade}
            </span>
          </span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex">
          {ITENS_MENU.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm font-medium text-zinc-300 transition hover:text-white"
            >
              {item.rotulo}
            </a>
          ))}
        </nav>

        <div className="hidden lg:block">
          <BotaoWhatsApp origem="cabecalho" tamanho="medio">
            Falar no WhatsApp
          </BotaoWhatsApp>
        </div>

        <button
          type="button"
          onClick={() => definirMenuAberto((aberto) => !aberto)}
          aria-expanded={menuAberto}
          aria-controls="menu-mobile"
          aria-label={menuAberto ? "Fechar menu" : "Abrir menu"}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/15 text-white transition hover:bg-white/10 lg:hidden"
        >
          {menuAberto ? <IconeFechar /> : <IconeMenu />}
        </button>
      </div>

      <div
        id="menu-mobile"
        hidden={!menuAberto}
        className="border-t border-white/10 bg-zinc-950 px-5 pb-6 pt-4 sm:px-8 lg:hidden"
      >
        <nav className="flex flex-col">
          {ITENS_MENU.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => definirMenuAberto(false)}
              className="border-b border-white/5 py-3 text-base font-medium text-zinc-200 transition hover:text-emerald-400"
            >
              {item.rotulo}
            </a>
          ))}
        </nav>
        <div className="mt-5">
          <BotaoWhatsApp origem="menu-mobile" tamanho="medio" className="w-full">
            Falar no WhatsApp
          </BotaoWhatsApp>
        </div>
      </div>
    </header>
  );
}
