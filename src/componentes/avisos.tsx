export type Tom = "boa" | "atencao" | "erro" | "calma";

const estilos: Record<Tom, string> = {
  boa: "border-oliva/30 bg-oliva/10 text-oliva",
  atencao: "border-amber-300/60 bg-amber-50 text-amber-800",
  erro: "border-rose-300/70 bg-rose-50 text-rose-800",
  calma: "border-areia-escura bg-areia/50 text-carvao-suave",
};

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

export function Etiqueta({ tom = "calma", children }: { tom?: Tom; children: React.ReactNode }) {
  return <span className={`etiqueta border ${estilos[tom]}`}>{children}</span>;
}

export function Vazio({
  titulo,
  texto,
}: {
  titulo: string;
  texto: string;
}) {
  return (
    <div className="rounded-3xl border border-dashed border-areia-escura bg-areia/30 px-6 py-10 text-center">
      <p className="font-display text-lg text-carvao">{titulo}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-carvao-suave">{texto}</p>
    </div>
  );
}
