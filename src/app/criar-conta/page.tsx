import Link from "next/link";
import { redirect } from "next/navigation";
import { Marca } from "@/componentes/marca";
import { usuarioAtual } from "@/lib/sessao";
import { DIAS_DE_TESTE, PLANO } from "@/lib/assinatura";
import { emReais } from "@/lib/formato";
import { FormularioCriarConta } from "./formulario";

export const metadata = { title: "Criar conta — Ateliê" };

export default async function PaginaCriarConta() {
  const usuario = await usuarioAtual();
  if (usuario) redirect("/painel");

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
            São {DIAS_DE_TESTE} dias por nossa conta. Depois, {emReais(PLANO.valorCentavos)} por
            mês no Pix, sem fidelidade.
          </p>

          <div className="cartao mt-7">
            <FormularioCriarConta />
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
