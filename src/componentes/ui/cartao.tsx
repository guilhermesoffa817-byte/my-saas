/**
 * Caixa branca com borda suave. É a unidade de agrupamento de todas as telas:
 * um assunto por cartão, para que no celular cada rolagem entregue uma ideia
 * inteira em vez de meia.
 */
export function Cartao({
  children,
  className = "",
  destaque = false,
}: {
  children: React.ReactNode;
  className?: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-superficie p-4 shadow-[0_10px_40px_-28px_rgba(11,18,32,0.5)] sm:p-5 ${
        destaque ? "border-terracota/40 ring-1 ring-terracota/20" : "border-areia-escura/70"
      } ${className}`}
    >
      {children}
    </div>
  );
}

/**
 * Título de seção com uma ação opcional ao lado. A ação fica à direita no
 * computador e desce para baixo do título no celular, onde não cabe ao lado.
 */
export function Secao({
  titulo,
  explicacao,
  acao,
  children,
}: {
  titulo: string;
  explicacao?: string;
  acao?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold text-carvao">{titulo}</h2>
          {explicacao ? (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-carvao-suave">
              {explicacao}
            </p>
          ) : null}
        </div>
        {acao ? <div className="shrink-0">{acao}</div> : null}
      </div>
      {children}
    </section>
  );
}

/** Título da tela. Uma por tela, sempre a primeira coisa. */
export function TituloDaTela({
  children,
  explicacao,
}: {
  children: React.ReactNode;
  explicacao?: string;
}) {
  return (
    <header className="animar-entrada">
      <h1 className="font-display text-2xl font-semibold text-carvao sm:text-3xl">
        {children}
      </h1>
      {explicacao ? (
        <p className="mt-2 max-w-2xl leading-relaxed text-carvao-suave">{explicacao}</p>
      ) : null}
    </header>
  );
}

/** Número grande com rótulo. Usado nos resumos do topo das telas. */
export function Indicador({
  rotulo,
  valor,
  detalhe,
  tom = "neutro",
  atraso = 0,
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  tom?: "neutro" | "destaque" | "atencao";
  atraso?: number;
}) {
  const cor =
    tom === "destaque"
      ? "text-terracota"
      : tom === "atencao"
        ? "text-amber-700 dark:text-amber-400"
        : "text-carvao";

  return (
    <Cartao className="animar-entrada" >
      <div style={{ animationDelay: `${atraso}ms` }}>
        <p className="text-xs font-semibold tracking-widest text-carvao-suave uppercase">
          {rotulo}
        </p>
        <p className={`mt-1.5 font-display text-2xl font-semibold tabular-nums ${cor}`}>
          {valor}
        </p>
        {detalhe ? <p className="mt-1 text-xs text-carvao-suave">{detalhe}</p> : null}
      </div>
    </Cartao>
  );
}
