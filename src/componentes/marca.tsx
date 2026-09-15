import Link from "next/link";

export function Marca({ href = "/", claro = false }: { href?: string; claro?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5">
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
          claro ? "bg-white text-terracota" : "bg-terracota text-white"
        }`}
        aria-hidden
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M12 3c-1.6 3.1-4 4.6-7 5 0 6.1 3 10 7 13 4-3 7-6.9 7-13-3-.4-5.4-1.9-7-5Z" />
        </svg>
      </span>
      <span
        className={`font-display text-xl font-semibold tracking-tight ${
          claro ? "text-white" : "text-carvao"
        }`}
      >
        Ateliê
      </span>
    </Link>
  );
}
