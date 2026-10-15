import Link from "next/link";
import { redirect } from "next/navigation";
import { Marca } from "@/componentes/marca";
import { usuarioAtual } from "@/lib/sessao";
import { DIAS_DE_TESTE, PLANOS } from "@/lib/assinatura";
import { emReais } from "@/lib/formato";
import { testeLiberaOVip } from "@/lib/site";
import { FormularioCriarConta } from "./formulario";

export const metadata = {
  title: "Criar conta",
  alternates: { canonical: "/criar-conta" },
};

/**
 * A frase de preço depende de onde a pessoa veio. Quem tocou no cartão do VIP
 * precisa ver o preço do VIP, e não o do Essencial; quem chegou sem escolher vê
 * o menor preço, com "a partir de". Os valores saem sempre de PLANOS, que é o
 * mesmo lugar de onde a tela de assinatura cobra.
 */
function fraseDoPreco(plano: string | undefined) {
  if (plano === "vip") {
    return `Depois, o VIP sai por ${emReais(PLANOS.vip_mensal.valorCentavos)} por mês no Pix, sem fidelidade.`;
  }
  if (plano === "essencial") {
    return `Depois, o Essencial sai por ${emReais(PLANOS.mensal.valorCentavos)} por mês no Pix, sem fidelidade.`;
  }
  const menor = Math.min(PLANOS.mensal.valorCentavos, PLANOS.vip_mensal.valorCentavos);
  return `Depois, a partir de ${emReais(menor)} por mês no Pix, sem fidelidade.`;
}

export default async function PaginaCriarConta({
  searchParams,
}: {
  searchParams: Promise<{ ind?: string; plano?: string }>;
}) {
  const usuario = await usuarioAtual();
  if (usuario) redirect("/painel");

  // Código de quem indicou, que veio no endereço do link, e o plano do cartão
  // em que a pessoa tocou na página inicial. Se um deles vier repetido no
  // endereço (?plano=a&plano=b), o Next entrega uma lista, e aí vale como se
  // não tivesse vindo.
  const { ind, plano } = await searchParams;
  const indicadoPor = typeof ind === "string" ? ind : null;
  const veioDoVip = plano === "vip";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-6xl px-5 py-6">
        <Marca />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg">
          <h1 className="font-display text-3xl font-semibold text-carvao">
            Vamos organizar o seu estúdio
          </h1>
          <p className="mt-2 text-carvao-suave">
            São {DIAS_DE_TESTE} dias por nossa conta.{" "}
            {fraseDoPreco(typeof plano === "string" ? plano : undefined)}
          </p>
          {veioDoVip && !testeLiberaOVip() ? (
            <p className="mt-2 text-sm leading-relaxed text-carvao-suave">
              No teste você usa a agenda, os clientes e as cobranças. Lembretes, contas
              a pagar, leitura de documentos e finanças abrem quando você assina o VIP.
            </p>
          ) : null}

          <div className="cartao mt-7">
            <FormularioCriarConta indicadoPor={indicadoPor} />
          </div>

          <p className="mt-6 text-center text-sm text-carvao-suave">
            Já tem conta?{" "}
            <Link href="/entrar" className="font-semibold text-terracota hover:underline">
              Entrar
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
