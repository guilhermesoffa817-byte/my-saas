"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * O link das faixas do topo do painel ("Escolher plano", "Ver como pagar").
 * Some na própria tela para onde leva: na assinatura, o botão que leva à
 * assinatura só ocupa espaço.
 */
export function LinkDaFaixa({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const caminho = usePathname();
  if (caminho === href.split("?")[0]) return null;
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}
