import Link from "next/link";
import { redirect } from "next/navigation";
import { Marca } from "@/componentes/marca";
import { Cartao } from "@/componentes/ui/cartao";
import { usuarioAtual } from "@/lib/sessao";
import { FormularioEntrar } from "./formulario";

export const metadata = { title: "Entrar" };

/**
 * A marca anda junto com o formulário, no mesmo bloco centralizado, como na
 * tela de "Esqueci minha senha". Presa no topo, ela deixava um vão grande entre
 * o nome do Bossa e o que a pessoa veio fazer.
 */
export default async function PaginaEntrar() {
  const usuario = await usuarioAtual();
  if (usuario) redirect("/painel");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8">
        <Marca />
      </div>

      <h1 className="font-display text-2xl font-semibold text-carvao sm:text-3xl">
        Que bom te ver de novo
      </h1>
      <p className="mt-2 leading-relaxed text-carvao-suave">
        Entre para ver a agenda de hoje e cuidar do seu estúdio.
      </p>

      <div className="mt-6">
        <Cartao>
          <FormularioEntrar />
        </Cartao>
      </div>

      <p className="mt-6 text-center text-sm text-carvao-suave">
        Ainda não tem conta?{" "}
        <Link href="/criar-conta" className="font-semibold text-terracota hover:underline">
          Criar a minha agora
        </Link>
      </p>
    </main>
  );
}
