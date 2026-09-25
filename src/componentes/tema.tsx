"use client";

import { useSyncExternalStore } from "react";

type Tema = "claro" | "escuro";

/**
 * Script que roda antes da página aparecer, para o tema salvo já valer no
 * primeiro desenho. Sem isso o site pisca branco antes de ficar escuro.
 */
export const scriptDoTema = `
(function () {
  try {
    var salvo = localStorage.getItem("tema");
    if (salvo === "claro" || salvo === "escuro") {
      document.documentElement.dataset.tema = salvo;
    }
  } catch (e) {}
})();
`;

/** O tema vive no `<html>`, fora do React — daí a leitura ser por assinatura. */
function assinar(avisar: () => void) {
  const observador = new MutationObserver(avisar);
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-tema"],
  });

  const preferencia = window.matchMedia("(prefers-color-scheme: dark)");
  preferencia.addEventListener("change", avisar);

  return () => {
    observador.disconnect();
    preferencia.removeEventListener("change", avisar);
  };
}

function lerTema(): Tema {
  const escolhido = document.documentElement.dataset.tema;
  if (escolhido === "claro" || escolhido === "escuro") return escolhido;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

function lerNoServidor(): Tema {
  return "claro";
}

export function BotaoTema({ claro = false }: { claro?: boolean }) {
  const tema = useSyncExternalStore(assinar, lerTema, lerNoServidor);
  const escuro = tema === "escuro";

  function alternar() {
    const novo: Tema = escuro ? "claro" : "escuro";
    document.documentElement.dataset.tema = novo;
    try {
      localStorage.setItem("tema", novo);
    } catch {
      // Navegador com armazenamento bloqueado: o tema vale só nesta visita.
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={escuro ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
      title={escuro ? "Tema claro" : "Tema escuro"}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition ${
        claro
          ? "border-inverso-texto/25 text-inverso-texto hover:border-inverso-texto/60"
          : "border-areia-escura text-carvao-suave hover:border-terracota hover:text-terracota"
      }`}
    >
      {escuro ? (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
          <path d="M12 3a1 1 0 0 1 .96 1.28A7 7 0 0 0 19.72 13a1 1 0 0 1 1.1 1.4A9 9 0 1 1 10.6 3.18 1 1 0 0 1 12 3Z" />
        </svg>
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
        </svg>
      )}
    </button>
  );
}
