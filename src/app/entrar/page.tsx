import Link from "next/link";
import { redirect } from "next/navigation";
import { Marca } from "@/componentes/marca";
import { usuarioAtual } from "@/lib/sessao";
import { FormularioEntrar } from "./formulario";

export const metadata = { title: "Entrar — Agenda Online" };

export default async function PaginaEntrar() {
  const usuario = await usuarioAtual();
  if (usuario) redirect("/painel");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-6xl px-5 py-6">
        <Marca />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl font-semibold text-carvao">
            Que bom te ver de novo
          </h1>
          <p className="mt-2 text-carvao-suave">
            Entre para ver a agenda de hoje e cuidar do seu estúdio.
          </p>

          <div className="cartao mt-7">
            <FormularioEntrar />
          </div>

          <p className="mt-6 text-center text-sm text-carvao-suave">
            Ainda não tem conta?{" "}
            <Link href="/criar-conta" className="font-semibold text-terracota hover:underline">
              Criar a minha agora
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
