import Link from "next/link";
import { Marca } from "@/componentes/marca";

export default function NaoEncontrado() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto w-full max-w-6xl px-5 py-6">
        <Marca />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="max-w-md text-center">
          <p className="font-display text-5xl font-semibold text-terracota">Ops</p>
          <h1 className="mt-4 font-display text-2xl font-semibold text-carvao">
            Essa página a gente não achou
          </h1>
          <p className="mt-3 leading-relaxed text-carvao-suave">
            Pode ser um link antigo ou um endereço digitado com um errinho. Sem problema,
            acontece com todo mundo.
          </p>
          <Link href="/" className="botao mt-8">
            Voltar para o começo
          </Link>
        </div>
      </main>
    </div>
  );
}
