import Link from "next/link";
import { connection } from "next/server";
import { Marca } from "@/componentes/marca";
import { Cartao } from "@/componentes/ui/cartao";
import { LinksDeContato } from "@/componentes/contato";
import { canaisDeContato } from "@/lib/contato";
import { FormularioDeRecuperacao } from "./formulario";

export const metadata = {
  title: "Esqueci minha senha",
  description: "Esqueceu a senha do Bossa? Diga o seu e-mail e receba pelo WhatsApp um link para escolher outra.",
  alternates: { canonical: "/esqueci-senha" },
};

export default async function PaginaEsqueciSenha() {
  // Os canais de contato vêm do ambiente do servidor: lidos a cada visita, e
  // não congelados no build, para trocar o contato sem publicar o site de novo.
  await connection();

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
          <FormularioDeRecuperacao
            contato={canaisDeContato().length ? <LinksDeContato /> : null}
          />
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
