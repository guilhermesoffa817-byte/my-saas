import Link from "next/link";
import { Marca } from "@/componentes/marca";
import { EMPRESA, aPreencher, whatsappDoBossa } from "@/lib/empresa";
import { FormularioDeRecuperacao } from "./formulario";

export const metadata = {
  title: "Esqueci minha senha",
  alternates: { canonical: "/esqueci-senha" },
};

/**
 * Mesmo desenho da tela de entrada e da de criar conta: quem chega aqui acabou
 * de sair de uma delas, e a tela não deve parecer outro site.
 */
export default function PaginaEsqueciSenha() {
  const whatsapp = whatsappDoBossa(
    "Oi! Troquei de número de WhatsApp e preciso de ajuda para entrar no Bossa.",
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-6xl px-5 py-6">
        <Marca />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <h1 className="font-display text-3xl font-semibold text-carvao">
            Esqueceu a senha?
          </h1>
          <p className="mt-2 leading-relaxed text-carvao-suave">
            Acontece. Diga o e-mail da sua conta e a gente manda um link para você
            escolher outra. O link vai pelo WhatsApp que está no seu cadastro.
          </p>

          <div className="cartao mt-7">
            <FormularioDeRecuperacao />
          </div>

          {/*
            O link sai para o número guardado na conta, e não para um número
            digitado aqui. Se aceitasse qualquer número, bastaria saber o e-mail
            de alguém para receber o acesso à conta dela.
          */}
          <p className="mt-6 text-sm leading-relaxed text-carvao-suave">
            Trocou de número desde que criou a conta? Então o link iria para o
            número antigo. Fale com a gente{" "}
            {whatsapp || EMPRESA.email ? (
              <>
                {whatsapp ? (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold whitespace-nowrap text-terracota hover:underline"
                  >
                    pelo WhatsApp {EMPRESA.whatsapp}
                  </a>
                ) : null}
                {whatsapp && EMPRESA.email ? " ou " : null}
                {EMPRESA.email ? (
                  <a
                    href={`mailto:${EMPRESA.email}`}
                    className="font-semibold wrap-anywhere text-terracota hover:underline"
                  >
                    pelo e-mail {EMPRESA.email}
                  </a>
                ) : null}
              </>
            ) : (
              <span className="font-semibold text-terracota">
                {aPreencher("WhatsApp ou e-mail do Bossa")}
              </span>
            )}
            : a gente confirma que a conta é sua e atualiza o número antes de mandar o
            link.
          </p>

          <p className="mt-6 text-center text-sm text-carvao-suave">
            Lembrou?{" "}
            <Link href="/entrar" className="font-semibold text-terracota hover:underline">
              Entrar no meu painel
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
