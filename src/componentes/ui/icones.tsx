/**
 * Os desenhos da navegação. Traço simples, todos no mesmo quadro de 24, para
 * que fiquem do mesmo peso na barra de baixo. Nenhum deles carrega informação
 * sozinho: ao lado de cada um há sempre a palavra escrita.
 */

const TRACOS: Record<string, string> = {
  casa: "M3 10.5 12 3l9 7.5M5.25 9.75V20a1 1 0 0 0 1 1h3.5v-5.5h4.5V21h3.5a1 1 0 0 0 1-1V9.75",
  calendario:
    "M7 3v3m10-3v3M3.5 9.5h17M5 6h14a1.5 1.5 0 0 1 1.5 1.5v12A1.5 1.5 0 0 1 19 21H5a1.5 1.5 0 0 1-1.5-1.5v-12A1.5 1.5 0 0 1 5 6Z",
  dinheiro:
    "M12 6v12m3-9.2c-.6-.9-1.7-1.3-3-1.3-1.8 0-3 .9-3 2.2 0 1.4 1.2 1.9 3 2.3 1.8.4 3 .9 3 2.3 0 1.3-1.2 2.2-3 2.2-1.4 0-2.5-.5-3-1.4",
  pessoas:
    "M15.5 20v-1.5a3.5 3.5 0 0 0-3.5-3.5H7a3.5 3.5 0 0 0-3.5 3.5V20M9.5 11.5a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Zm11 8.5v-1.5a3.5 3.5 0 0 0-2.6-3.4M16 5.2a3.25 3.25 0 0 1 0 6.3",
  etiqueta:
    "M3.5 11.2V5.5a2 2 0 0 1 2-2h5.7a2 2 0 0 1 1.4.6l7.3 7.3a2 2 0 0 1 0 2.8l-5.7 5.7a2 2 0 0 1-2.8 0L4.1 12.6a2 2 0 0 1-.6-1.4Zm4.4-3.3h.01",
  sino: "M18 8.5a6 6 0 1 0-12 0c0 5-2 6.5-2 6.5h16s-2-1.5-2-6.5ZM13.7 19a2 2 0 0 1-3.4 0",
  papel:
    "M14 3.5H7a1.5 1.5 0 0 0-1.5 1.5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8M14 3.5 18.5 8M14 3.5V8h4.5M8.5 12.5h7m-7 3.5h4.5",
  grafico: "M4 20V10m5 10V4m5 16v-7m5 7V7",
  cartao: "M3.5 7.5A1.5 1.5 0 0 1 5 6h14a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 18H5a1.5 1.5 0 0 1-1.5-1.5v-9Zm0 3h17M6.5 14.5h3",
  chave:
    "M14.5 9.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm0 0H21m-2.5 0v3m-2.5-3v2",
  mais: "M4.5 7h15m-15 5h15m-15 5h15",
};

export function Icone({ nome, className = "" }: { nome: string; className?: string }) {
  const traco = TRACOS[nome] ?? TRACOS.mais;

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <path d={traco} />
    </svg>
  );
}
