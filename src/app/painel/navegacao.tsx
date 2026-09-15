"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const itens = [
  { href: "/painel", rotulo: "Início" },
  { href: "/painel/agenda", rotulo: "Agenda" },
  { href: "/painel/clientes", rotulo: "Clientes" },
  { href: "/painel/servicos", rotulo: "Serviços" },
  { href: "/painel/assinatura", rotulo: "Assinatura" },
];

export function Navegacao({ admin }: { admin: boolean }) {
  const caminho = usePathname();
  const lista = admin ? [...itens, { href: "/painel/admin", rotulo: "Pagamentos" }] : itens;

  return (
    <nav className="flex gap-1.5 overflow-x-auto pb-1">
      {lista.map((item) => {
        const ativo =
          item.href === "/painel" ? caminho === "/painel" : caminho.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={ativo ? "page" : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
              ativo
                ? "bg-terracota text-white"
                : "text-carvao-suave hover:bg-areia/70 hover:text-carvao"
            }`}
          >
            {item.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
