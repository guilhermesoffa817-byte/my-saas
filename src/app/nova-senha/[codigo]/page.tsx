import Link from "next/link";
import { Marca } from "@/componentes/marca";
import { Cartao } from "@/componentes/ui/cartao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { conferirCodigo } from "@/app/acoes/senha";
import { MINUTOS_DE_VALIDADE } from "@/lib/senha";
import { FormularioDeNovaSenha } from "./formulario";

export const metadata = { title: "Escolher uma senha nova" };
export const dynamic = "force-dynamic";

export default async function PaginaNovaSenha({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const pedido = await conferirCodigo(codigo);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-8">
        <Marca />
      </div>

      {!pedido ? (
        <>
          <h1 className="font-display text-2xl font-semibold text-carvao sm:text-3xl">
            Esse link não vale mais
          </h1>
          <p className="mt-2 leading-relaxed text-carvao-suave">
            Links de senha valem por {MINUTOS_DE_VALIDADE} minutos e só funcionam
            uma vez. Peça outro e a gente te manda um novo.
          </p>
          <Link href="/esqueci-senha" className="botao mt-6 w-full">
            Pedir outro link
          </Link>
        </>
      ) : (
        <>
          <h1 className="font-display text-2xl font-semibold text-carvao sm:text-3xl">
            Escolha uma senha nova
          </h1>
          <p className="mt-2 leading-relaxed text-carvao-suave">
            Para a conta de {pedido.usuario.email}.
          </p>

          <div className="mt-6 space-y-4">
            <Aviso tom="calma">
              Ao salvar, quem estiver com essa conta aberta em outro aparelho vai
              precisar entrar de novo.
            </Aviso>
            <Cartao>
              <FormularioDeNovaSenha codigo={codigo} />
            </Cartao>
          </div>
        </>
      )}
    </div>
  );
}
