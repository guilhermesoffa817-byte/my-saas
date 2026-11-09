"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  CHAVE_DO_CONSENTIMENTO,
  EVENTOS,
  PARAMETRO_DO_EVENTO,
  eventoDoParametro,
  rotaPublica,
  type IdsDeMedicao,
} from "@/lib/medicao";

/*
  Liga o Google Analytics, o Meta Pixel e o Clarity depois que a visitante
  aceita o aviso de cookies. As regras estão em src/lib/medicao.ts.
*/

type Resposta = "sim" | "nao" | null;

type Fila = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  q?: unknown[];
  push?: unknown;
  loaded?: boolean;
  version?: string;
};

type Janela = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: Fila;
  _fbq?: unknown;
  clarity?: Fila;
};

function lerResposta(): Resposta {
  try {
    const valor = window.localStorage.getItem(CHAVE_DO_CONSENTIMENTO);
    return valor === "sim" || valor === "nao" ? valor : null;
  } catch {
    return null;
  }
}

function guardarResposta(valor: "sim" | "nao") {
  try {
    window.localStorage.setItem(CHAVE_DO_CONSENTIMENTO, valor);
  } catch {
    // Navegador sem armazenamento: vale só nesta visita.
  }
}

function carregarScript(endereco: string) {
  if (document.querySelector(`script[src="${endereco}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = endereco;
  document.head.appendChild(script);
}

function ligarGoogle(id: string) {
  const w = window as Janela;
  if (w.gtag) return;
  w.dataLayer = w.dataLayer ?? [];
  w.gtag = function gtag() {
    // O gtag exige o objeto `arguments`, não um array.
    // eslint-disable-next-line prefer-rest-params
    w.dataLayer!.push(arguments);
  };
  w.gtag("js", new Date());
  // As páginas vistas são mandadas à mão, a cada troca de endereço.
  w.gtag("config", id, { send_page_view: false });
  carregarScript(`https://www.googletagmanager.com/gtag/js?id=${id}`);
}

function ligarMeta(id: string) {
  const w = window as Janela;
  if (w.fbq) return;
  const fbq: Fila = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue!.push(args);
  };
  fbq.queue = [];
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  w.fbq = fbq;
  w._fbq = fbq;
  // Sem a coleta automática de cliques e textos da página.
  fbq("set", "autoConfig", false, id);
  fbq("init", id);
  carregarScript("https://connect.facebook.net/en_US/fbevents.js");
}

function ligarClarity(id: string) {
  const w = window as Janela;
  if (w.clarity) return;
  const clarity: Fila = function (...args: unknown[]) {
    (clarity.q = clarity.q ?? []).push(args);
  };
  w.clarity = clarity;
  carregarScript(`https://www.clarity.ms/tag/${id}`);
}

function registrarPagina(ids: IdsDeMedicao) {
  const w = window as Janela;
  if (ids.googleAnalytics && w.gtag) {
    w.gtag("event", "page_view", {
      page_location: window.location.origin + window.location.pathname,
      page_title: document.title,
    });
  }
  if (ids.metaPixel && w.fbq) w.fbq("track", "PageView");
}

export function Medicao({ ids }: { ids: IdsDeMedicao }) {
  const caminho = usePathname() ?? "/";
  // Lido do navegador depois de abrir a página; no servidor ainda não há resposta.
  const guardada = useSyncExternalStore(
    () => () => {},
    lerResposta,
    () => "servidor" as const,
  );
  const pronto = guardada !== "servidor";
  const [respondida, setRespondida] = useState<Resposta>(null);
  const resposta: Resposta = respondida ?? (pronto ? guardada : null);

  useEffect(() => {
    if (!pronto || resposta !== "sim") return;
    const publica = rotaPublica(caminho);
    const evento = eventoDoParametro(
      new URLSearchParams(window.location.search).get(PARAMETRO_DO_EVENTO),
    );
    if (!publica && !evento) return;

    // Google e Meta servem para os anúncios; o Clarity grava a tela, então
    // nunca liga fora das páginas públicas.
    if (ids.googleAnalytics) ligarGoogle(ids.googleAnalytics);
    if (ids.metaPixel) ligarMeta(ids.metaPixel);
    if (ids.clarity && publica) ligarClarity(ids.clarity);

    if (publica) registrarPagina(ids);

    if (evento) {
      const w = window as Janela;
      if (ids.googleAnalytics && w.gtag) w.gtag("event", EVENTOS[evento].google);
      if (ids.metaPixel && w.fbq) w.fbq("track", EVENTOS[evento].meta);
      // Tira o parâmetro do endereço para o evento não contar de novo ao recarregar.
      const url = new URL(window.location.href);
      url.searchParams.delete(PARAMETRO_DO_EVENTO);
      window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    }
  }, [pronto, resposta, caminho, ids]);

  // O aviso só aparece nas páginas públicas e só até a pessoa responder.
  if (!pronto || resposta !== null || !rotaPublica(caminho)) return null;

  const responder = (valor: "sim" | "nao") => {
    guardarResposta(valor);
    setRespondida(valor);
  };

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-areia-escura bg-superficie p-4 text-sm text-carvao shadow-lg sm:inset-x-4"
    >
      <p>
        Usamos cookies para saber como as pessoas chegam ao site e melhorar nossos anúncios. Os
        dados do seu estúdio nunca entram nisso.{" "}
        <Link href="/privacidade#cookies" className="font-semibold text-terracota underline">
          Saiba mais
        </Link>
      </p>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => responder("nao")}
          className="rounded-full px-4 py-2 font-semibold text-carvao-suave hover:bg-areia"
        >
          Agora não
        </button>
        <button
          type="button"
          onClick={() => responder("sim")}
          className="rounded-full bg-terracota px-4 py-2 font-semibold text-acento-texto hover:bg-terracota-escura"
        >
          Aceitar
        </button>
      </div>
    </div>
  );
}
