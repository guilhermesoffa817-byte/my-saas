import Link from "next/link";
import { MES_FECHADO } from "@/lib/fechamento/trava";

/**
 * O recado de quando uma ação sem resposta na tela (um botão "Apagar", um
 * "Concluir") esbarra num mês fechado. A ação volta para a mesma tela com
 * `?aviso=mes-fechado` e este quadro explica o que houve e onde reabrir.
 */
export function AvisoDeMesFechado({ aviso, mes }: { aviso?: string; mes?: string }) {
  if (aviso !== "mes-fechado") return null;
  const destino = mes ? `/painel/financas/relatorio?mes=${mes}` : "/painel/financas/relatorio";
  return (
    <div
      role="status"
      className="rounded-2xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm leading-relaxed text-rose-800 dark:border-rose-400/30 dark:bg-rose-400/10 dark:text-rose-300"
    >
      {MES_FECHADO} Nada foi mudado.{" "}
      <Link href={destino} className="font-semibold underline underline-offset-2">
        Ver o fechamento
      </Link>
    </div>
  );
}
