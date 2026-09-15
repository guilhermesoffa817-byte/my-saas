"use client";

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="max-w-md text-center">
        <p className="font-display text-5xl font-semibold text-terracota">Puxa</p>
        <h1 className="mt-4 font-display text-2xl font-semibold text-carvao">
          Alguma coisa não carregou direito
        </h1>
        <p className="mt-3 leading-relaxed text-carvao-suave">
          Nada foi perdido: seus dados estão guardados. Tente de novo e, se insistir em dar
          errado, fale com a gente que resolvemos rapidinho.
        </p>
        <button type="button" onClick={reset} className="botao mt-8">
          Tentar de novo
        </button>
      </div>
    </div>
  );
}
