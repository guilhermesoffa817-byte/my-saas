import Link from "next/link";
import { exigirLeituraDoRecurso } from "@/lib/guardas";
import { podeUsar } from "@/lib/recursos";
import { Cartao, TituloDaTela } from "@/componentes/ui/cartao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { chavePorExtenso, lerChavePix } from "@/lib/pix";
import { FormularioDeAjustes } from "./formulario";

export const metadata = { title: "Ajustes das cobranças" };
export const dynamic = "force-dynamic";

export default async function PaginaAjustesDeCobranca() {
  const { usuario } = await exigirLeituraDoRecurso("cobrar");
  const temLembretes = podeUsar(usuario, "lembretes");
  // Como a chave guardada é lida hoje: é ela que vai em todo código Pix.
  const leitura = usuario.pixChave ? lerChavePix(usuario.pixChave) : null;

  return (
    <div className="space-y-6">
      <TituloDaTela explicacao="Sua chave Pix e quando o Bossa deve te lembrar.">
        Ajustes das cobranças
      </TituloDaTela>

      {!temLembretes ? (
        <Aviso tom="calma">
          Escolher os momentos do lembrete faz parte do plano Completo. A chave Pix
          você cadastra do mesmo jeito.{" "}
          <Link href="/painel/assinatura?completo=1" className="font-semibold underline">
            Conhecer o Completo
          </Link>
        </Aviso>
      ) : null}

      {leitura?.certo ? (
        <p className="text-sm text-carvao-suave">
          Os códigos Pix saem para: <strong className="text-carvao">{chavePorExtenso(leitura)}</strong>
        </p>
      ) : leitura ? (
        <Aviso tom="atencao">
          {leitura.motivo === "ambigua"
            ? "A chave cadastrada pode ser um CPF ou um celular. Escolha o tipo abaixo e salve: até lá, as mensagens saem sem o código Pix."
            : `${leitura.mensagem} Até corrigir, as mensagens saem sem o código Pix.`}
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
