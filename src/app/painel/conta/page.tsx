import Link from "next/link";
import { exigirUsuario } from "@/lib/guardas";
import { cepBonito, documentoBonito, telefoneBonito } from "@/lib/formato";
import { Cartao, Secao, TituloDaTela } from "@/componentes/ui/cartao";
import { Aviso } from "@/componentes/ui/etiqueta";
import { Icone } from "@/componentes/ui/icones";
import { PLANILHAS } from "@/app/api/exportar/planilhas";
import {
  FormularioDaSenha,
  FormularioDeExclusao,
  FormularioDosDados,
} from "./formularios";

export const metadata = { title: "Minha conta" };
export const dynamic = "force-dynamic";

/**
 * Cadastro, senha, cópia dos dados e exclusão da conta.
 *
 * Abre mesmo com a assinatura vencida: corrigir o próprio WhatsApp, trocar a
 * senha, levar os dados embora e encerrar a conta não podem depender de estar
 * em dia com o pagamento.
 */
export default async function PaginaMinhaConta() {
  const usuario = await exigirUsuario();
  const administracao = usuario.papel === "admin";

  return (
    <div className="space-y-10">
      <TituloDaTela explicacao="Seus dados de cadastro, a sua senha e uma cópia de tudo o que é seu.">
        Minha conta
      </TituloDaTela>

      <Secao titulo="Seus dados">
        <Cartao>
          <FormularioDosDados
            inicial={{
              nome: usuario.nome,
              nomeNegocio: usuario.nomeNegocio,
              email: usuario.email,
              telefone: telefoneBonito(usuario.telefone ?? ""),
              documento: documentoBonito(usuario.documento),
              cep: cepBonito(usuario.cep),
              endereco: usuario.endereco ?? "",
            }}
          />
        </Cartao>
      </Secao>

      <Secao
        titulo="Senha"
        explicacao="Ao trocar, a conta se fecha nos outros aparelhos em que estiver aberta. Neste, você continua dentro."
      >
        <Cartao>
          <FormularioDaSenha />
        </Cartao>
      </Secao>

      <Secao
        titulo="Baixar meus dados"
        explicacao="Planilhas que abrem no Excel e no Google Planilhas. Os dados são seus: leve uma cópia quando quiser."
      >
        <Cartao>
          <ul className="divide-y divide-areia-escura/70">
            {PLANILHAS.map((planilha) => (
              <li
                key={planilha.tipo}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-carvao">{planilha.rotulo}</p>
                  <p className="text-sm leading-relaxed text-carvao-suave">
                    {planilha.explicacao}
                  </p>
                </div>
                {/* Link comum, e não do Next: é um arquivo para baixar, não uma tela. */}
                <a
                  href={`/api/exportar/${planilha.tipo}`}
                  download
                  className="botao-suave shrink-0 px-4 whitespace-nowrap"
                >
                  <Icone nome="baixar" className="h-4 w-4" />
                  Baixar
                </a>
              </li>
            ))}
          </ul>
        </Cartao>
      </Secao>

      <Secao
        titulo="Excluir minha conta"
        explicacao="Apaga a conta e tudo o que está nela: clientes, agenda, cobranças, finanças, vencimentos e documentos enviados. A assinatura acaba junto. Não dá para desfazer, então baixe as planilhas acima antes se quiser guardar uma cópia."
      >
        <Cartao>
          {administracao ? (
            <Aviso tom="calma">
              Esta é a conta da administração do Bossa, e ela não pode ser excluída por
              aqui. É ela que confere os Pix das assinaturas e gera os links de senha
              nova: sem ela, nenhum estúdio conseguiria voltar a entrar depois de pagar.
            </Aviso>
          ) : (
            <FormularioDeExclusao />
          )}
        </Cartao>
      </Secao>

      <p className="text-sm leading-relaxed text-carvao-suave">
        Quer saber como cuidamos dos seus dados?{" "}
        <Link
          href="/privacidade"
          className="font-semibold text-terracota hover:underline"
        >
          Leia a política de privacidade
        </Link>
        .
      </p>
    </div>
  );
}
