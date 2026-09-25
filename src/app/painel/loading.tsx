/**
 * Enquanto o servidor monta a página, esta tela aparece na hora — o clique no
 * menu responde na mesma hora em vez de deixar tudo parado. O Next.js também
 * usa a existência deste arquivo para adiantar parte do carregamento quando o
 * ponteiro passa por cima do menu.
 */
export default function Carregando() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Carregando…</span>

      <section className="space-y-3">
        <Barra className="h-8 w-56" />
        <Barra className="h-4 w-full max-w-xl" />
      </section>

      <section className="cartao space-y-4">
        <Barra className="h-5 w-44" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Barra className="h-11" />
          <Barra className="h-11" />
        </div>
        <Barra className="h-11 w-40" />
      </section>

      <section className="space-y-3">
        {[0, 1, 2].map((posicao) => (
          <div key={posicao} className="cartao flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2.5">
              <Barra className="h-5 w-40" />
              <Barra className="h-4 w-64 max-w-full" />
            </div>
            <Barra className="h-8 w-24 shrink-0" />
          </div>
        ))}
      </section>
    </div>
  );
}

function Barra({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-areia-escura/50 motion-reduce:animate-none ${className}`}
      aria-hidden
    />
  );
}
