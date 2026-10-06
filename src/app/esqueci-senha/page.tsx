import Link from "next/link";
import { Marca } from "@/componentes/marca";
import { Cartao } from "@/componentes/ui/cartao";
import { FormularioDeRecuperacao } from "./formulario";

export const metadata = { title: "Esqueci minha senha" };

export default function PaginaEsqueciSenha() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8">
        <Marca />
      </div>

      <h1 className="font-display text-2xl font-semibold text-carvao sm:text-3xl">
        Esqueceu a senha?
      </h1>
      <p className="mt-2 leading-relaxed text-carvao-suave">
        Acontece. Diga o seu e-mail e a gente te manda um link pelo WhatsApp para
        você escolher outra.
      </p>

      <div className="mt-6">
        <Cartao>
          <FormularioDeRecuperacao />
        </Cartao>
      </div>

      <p className="mt-6 text-center text-sm text-carvao-suave">
        Lembrou?{" "}
        <Link href="/entrar" className="font-semibold text-terracota hover:underline">
          Entrar no meu painel
        </Link>
      </p>
    </div>
  );
}
