"use client";

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="max-w-md text-center">
        <p className="font-display text-5xl font-semibold text-terracota">Puxa</p>
        <h1 className="mt-4 font-display text-2xl font-semibold text-carvao">
          Alguma coisa não carregou direito
        </h1>
        {/*
          Sem "fale com a gente": esta tela roda no navegador e não enxerga os
          canais de contato, que só existem no servidor (lib/contato.ts).
        */}
        <p className="mt-3 leading-relaxed text-carvao-suave">
          Nada foi perdido: seus dados estão guardados. Tente de novo; se continuar, espere alguns
          minutos e abra a página outra vez.
        </p>
        <button type="button" onClick={reset} className="botao mt-8">
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
