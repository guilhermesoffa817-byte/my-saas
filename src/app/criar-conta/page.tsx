import Link from "next/link";
import { redirect } from "next/navigation";
import { Marca } from "@/componentes/marca";
import { usuarioAtual } from "@/lib/sessao";
import { PLANOS } from "@/lib/assinatura";
import { emReais } from "@/lib/formato";
import { FormularioCriarConta } from "./formulario";

export const metadata = {
  title: "Criar conta",
  description:
    "Crie a sua conta no Bossa e conheça o sistema num estúdio de exemplo, com agenda, cobranças e finanças funcionando, antes de escolher um plano.",
  alternates: { canonical: "/criar-conta" },
};

export default async function PaginaCriarConta({
  searchParams,
}: {
  searchParams: Promise<{ ind?: string; demonstracao?: string }>;
}) {
  const usuario = await usuarioAtual();
  if (usuario) redirect("/painel");

  // Código de quem indicou, que veio no endereço do link.
  const { ind, demonstracao } = await searchParams;

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
          {demonstracao ? (
            /* Veio do exemplo, depois de tentar fazer alguma coisa sem conta. */
            <p role="status" className="mt-4 rounded-xl bg-terracota/10 px-4 py-3 text-sm text-carvao">
              No exemplo dá para olhar tudo, mas não para mudar. Para usar com os seus clientes,
              crie a sua conta.
            </p>
          ) : null}
          <p className="mt-2 text-carvao-suave">
            Assim que criar a conta, você entra num estúdio de exemplo com todas as funções
            funcionando. Para usar com os seus clientes, os planos começam em{" "}
            {emReais(PLANOS.mensal.valorCentavos)} por mês no Pix, sem fidelidade.
          </p>

          <div className="cartao mt-7">
            <FormularioCriarConta indicadoPor={ind ?? null} />
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
