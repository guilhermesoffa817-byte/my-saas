import Link from "next/link";
import { exigirRecurso } from "@/lib/guardas";
import { podeUsar } from "@/lib/recursos";
import { Cartao, TituloDaTela } from "@/componentes/ui/cartao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { FormularioDeAjustes } from "./formulario";

export const metadata = { title: "Ajustes das cobranças" };
export const dynamic = "force-dynamic";

export default async function PaginaAjustesDeCobranca() {
  const { usuario } = await exigirRecurso("cobrar");
  const temLembretes = podeUsar(usuario, "lembretes");

  return (
    <div className="space-y-6">
      <TituloDaTela explicacao="Sua chave Pix e quando o Bossa deve te lembrar.">
        Ajustes das cobranças
      </TituloDaTela>

      {!temLembretes ? (
        <Aviso tom="calma">
          Escolher os momentos do lembrete faz parte do plano VIP. A chave Pix
          você cadastra do mesmo jeito.{" "}
          <Link href="/painel/assinatura?vip=1" className="font-semibold underline">
            Conhecer o VIP
          </Link>
        </Aviso>
      ) : null}

      <Cartao>
        <FormularioDeAjustes
          pixChave={usuario.pixChave ?? ""}
          pixCidade={usuario.pixCidade ?? ""}
          temLembretes={temLembretes}
          lembretes={{
            antes: usuario.lembreteAntes,
            no_dia: usuario.lembreteNoDia,
            tres_dias: usuario.lembreteTresDias,
            sete_dias: usuario.lembreteSeteDias,
          }}
        />
      </Cartao>

      <Link href="/painel/cobrancas" className="botao-suave">
        Voltar para as cobranças
      </Link>
    </div>
  );
}
