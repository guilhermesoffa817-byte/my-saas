/**
 * As situações que aparecem em lista: cobrança, vencimento, documento e
 * agendamento. O tom traduz a situação em cor, mas a palavra é sempre escrita,
 * porque ninguém deve depender de enxergar a diferença entre dois tons.
 */

export type Tom = "boa" | "atencao" | "erro" | "calma" | "espera";

const estilos: Record<Tom, string> = {
  boa: "border-oliva/30 bg-oliva/10 text-oliva",
  atencao: "border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-300",
  erro: "border-rose-300/70 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300",
  calma: "border-areia-escura bg-areia/50 text-carvao-suave",
  espera: "border-terracota/30 bg-terracota/10 text-terracota",
};

export function Etiqueta({
  tom = "calma",
  children,
}: {
  tom?: Tom;
  children: React.ReactNode;
}) {
  return <span className={`etiqueta border ${estilos[tom]}`}>{children}</span>;
}

export function Aviso({
  tom = "calma",
  children,
}: {
  tom?: Tom;
  children: React.ReactNode;
}) {
  return (
    <p
      role="status"
      className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${estilos[tom]}`}
    >
      {children}
    </p>
  );
}

/** Situações da cobrança, com o tom de cada uma num lugar só. */
export const TOM_DA_COBRANCA: Record<string, Tom> = {
  aberta: "espera",
  atrasada: "erro",
  paga: "boa",
  cancelada: "calma",
};

export const ROTULO_DA_COBRANCA: Record<string, string> = {
  aberta: "Em aberto",
  atrasada: "Atrasada",
  paga: "Paga",
  cancelada: "Cancelada",
};

/** Situações do vencimento. */
export const TOM_DO_VENCIMENTO: Record<string, Tom> = {
  a_pagar: "espera",
  vence_hoje: "atencao",
  atrasado: "erro",
  pago: "boa",
};

export const ROTULO_DO_VENCIMENTO: Record<string, string> = {
  a_pagar: "A pagar",
  vence_hoje: "Vence hoje",
  atrasado: "Atrasado",
  pago: "Pago",
};

/** Situações do documento. */
export const TOM_DO_DOCUMENTO: Record<string, Tom> = {
  lendo: "espera",
  pronto: "atencao",
  conferido: "boa",
  falhou: "erro",
};

export const ROTULO_DO_DOCUMENTO: Record<string, string> = {
  lendo: "Lendo",
  pronto: "Pronto para conferir",
  conferido: "Conferido",
  falhou: "Não consegui ler",
};
