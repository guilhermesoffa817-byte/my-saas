import Link from "next/link";
import { NOME_DO_PRODUTO } from "@/lib/site";

/**
 * `encolhe`: abaixo de 340px de largura fica só o escudo, e o nome continua
 * lá para leitor de tela. É o que deixa o topo das páginas públicas caber
 * numa linha, sem rolar para o lado, num celular de 320px.
 */
export function Marca({
  href = "/",
  claro = false,
  encolhe = false,
}: {
  href?: string;
  claro?: boolean;
  encolhe?: boolean;
}) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
          claro ? "bg-superficie text-terracota" : "bg-terracota text-acento-texto"
        }`}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M12 3c-1.6 3.1-4 4.6-7 5 0 6.1 3 10 7 13 4-3 7-6.9 7-13-3-.4-5.4-1.9-7-5Z" />
        </svg>
      </span>
      <span
        className={`font-display text-xl font-semibold tracking-tight ${
          claro ? "text-inverso-texto" : "text-carvao"
        } ${encolhe ? "max-[339px]:sr-only" : ""}`}
      >
        {NOME_DO_PRODUTO}
      </span>
    </Link>
  );
}
