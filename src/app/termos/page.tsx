import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal, Revisar, Secao } from "@/componentes/pagina-legal";
import { PLANOS, economiaDoAnual } from "@/lib/assinatura";
import { DIAS_PARA_DESISTIR } from "@/lib/leis";
import { RESPONSAVEL, emailDeContatoValido } from "@/lib/contato";
import { emReais } from "@/lib/formato";
import {
  CLASSIFICACOES_POR_MES_NO_COMPLETO,
  LEITURAS_POR_MES_NO_COMPLETO,
  PERGUNTAS_POR_MES_NO_COMPLETO,
} from "@/lib/recursos";
import { NOME_DO_PRODUTO } from "@/lib/site";

export const metadata: Metadata = {
  title: "Termos de uso",
  description:
    "As condições de uso do Bossa: o que o sistema faz, o que ele não faz, como funcionam a demonstração, a assinatura, a garantia de 7 dias e as responsabilidades de cada lado.",
  alternates: { canonical: "/termos" },
};

/**
 * Os termos de uso, escritos a partir do que o produto faz hoje.
 *
 * A parte "O que o Bossa não faz" é a mais importante: ela segura a promessa
 * da página de vendas. Preços, teste e franquias vêm das mesmas constantes que
 * o sistema usa, para nunca desencontrarem.
 *
 * Os trechos marcados [REVISAR COM ADVOGADO] e [EXEMPLO] precisam passar por
 * revisão jurídica antes de a página valer como versão final.
 */

const SUMARIO = [
  { id: "o-que-faz", titulo: "O que o Bossa faz" },
  { id: "nao-faz", titulo: "O que o Bossa não faz" },
  { id: "conta", titulo: "Sua conta" },
  { id: "assinatura", titulo: "Demonstração, assinatura e garantia" },
  { id: "ia", titulo: "Inteligência artificial" },
  { id: "responsabilidades", titulo: "Suas responsabilidades" },
  { id: "links", titulo: "Link de agendamento e link do contador" },
  { id: "disponibilidade", titulo: "Disponibilidade e limites" },
  { id: "mudancas", titulo: "Mudanças, lei e contato" },
];

export default function PaginaTermos() {
  return (
    <PaginaLegal
      titulo="Termos de uso"
      atualizadaEm="16 de outubro de 2026"
      sumario={SUMARIO}
      resumo={
        <>
          <p className="font-semibold">Em poucas linhas</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
            <li>
              O {NOME_DO_PRODUTO} organiza a agenda, as cobranças e o dinheiro do seu estúdio. Ele
              não substitui o seu contador.
            </li>
            <li>
              Antes de pagar, você conhece o sistema num estúdio de exemplo. Para usar com os seus
              clientes, paga por Pix, sem fidelidade e sem multa.
            </li>
            <li>
              Você tem {DIAS_PARA_DESISTIR} dias, contados do pagamento, para desistir e receber o
              dinheiro de volta.
            </li>
            <li>
              O que a IA sugere é informativo e pode ter erro. Confira antes de usar.
            </li>
          </ul>
        </>
      }
    >
      <Secao id="o-que-faz" titulo="1. O que o Bossa faz">
        <p>
          O {NOME_DO_PRODUTO} é um sistema na internet para estúdios e profissionais que atendem com
          hora marcada. Ao aceitar estes termos, você pode usá-lo conforme o plano que escolher:
        </p>
        <ul>
          <li>
            <strong>Simples:</strong> agenda, link de agendamento, ficha de clientes, serviços,
            cobranças pelo WhatsApp com código Pix e finanças (entradas, saídas, resumo do mês e
            imposto estimado).
          </li>
          <li>
            <strong>Completo:</strong> tudo do Simples, mais lembretes de cobrança, contas a pagar,
            leitura de documentos por IA, custos, relatório e fechamento do mês, link do contador,
            equipe e assistente.
          </li>
        </ul>
      </Secao>

      <Secao id="nao-faz" titulo="2. O que o Bossa não faz">
        <ul>
          <li>
            <strong>Não substitui o contador</strong> e não presta serviço de contabilidade,
            consultoria jurídica ou financeira.
          </li>
          <li>
            <strong>Não calcula o imposto devido.</strong> O &ldquo;imposto estimado&rdquo; é só o
            percentual que você informa aplicado ao que entrou no mês. É uma estimativa para você se
            planejar, não é guia nem valor a pagar.
          </li>
          <li>Não emite nota fiscal nem guia de imposto.</li>
          <li>
            <strong>Não faz folha de pagamento</strong>, não calcula salário líquido, encargos,
            férias, 13º ou rescisão, e não envia nada ao eSocial nem a outro órgão. Os valores da
            equipe são os que você registra, a partir do que o seu contador mandou.
          </li>
          <li>Não diz se alguém da equipe é empregado, parceiro ou prestador de serviço.</li>
          <li>Não é prontuário e não deve receber dados de saúde.</li>
          <li>
            Não manda mensagem sozinho: abre o WhatsApp com a mensagem pronta, e quem envia é você.
          </li>
          <li>
            Não recebe dinheiro pelos seus clientes: o Pix das cobranças cai direto na chave que você
            cadastrou.
          </li>
          <li>
            As sugestões da IA (leitura de documentos, classificação de custos e assistente) são
            informativas, podem conter erros e não são consultoria.
          </li>
        </ul>
      </Secao>

      <Secao id="conta" titulo="3. Sua conta">
        <ul>
          <li>Cada conta é de um estúdio. Use dados verdadeiros no cadastro.</li>
          <li>
            Guarde a sua senha. O que for feito com ela é responsabilidade de quem tem a conta.
          </li>
          <li>
            Para criar a conta é preciso ter 18 anos ou mais e poder contratar em nome do negócio.{" "}
            <Revisar />
          </li>
        </ul>
      </Secao>

      <Secao id="assinatura" titulo="4. Teste, assinatura e pagamento">
        <ul>
          <li>
            Não há teste grátis com os seus dados. Ao criar a conta, você entra numa demonstração:
            um estúdio de exemplo, com dados inventados, em que dá para ver todas as funções dos
            dois planos. Na demonstração nada é gravado; para cadastrar os seus clientes e usar de
            verdade, é preciso escolher um plano.
          </li>
          <li>
            Preços de hoje: Simples {emReais(PLANOS.mensal.valorCentavos)} por mês ou{" "}
            {emReais(PLANOS.anual.valorCentavos)} por ano; Completo{" "}
            {emReais(PLANOS.vip_mensal.valorCentavos)} por mês ou{" "}
            {emReais(PLANOS.vip_anual.valorCentavos)} por ano. No anual, a economia em relação a
            doze mensalidades é de {emReais(economiaDoAnual("simples"))} no Simples e{" "}
            {emReais(economiaDoAnual("completo"))} no Completo.
          </li>
          <li>
            O pagamento é por Pix. Depois que você avisa o pagamento no painel, conferimos o Pix e
            liberamos o período do plano.
          </li>
          <li>
            Não há fidelidade nem multa. Se você não renovar, o acesso ao painel pausa ao fim do
            período pago e os dados ficam guardados, como explica a{" "}
            <Link href="/privacidade#prazos" className="font-semibold text-terracota hover:underline">
              Política de privacidade
            </Link>
            .
          </li>
          <li>
            <strong>Garantia de {DIAS_PARA_DESISTIR} dias:</strong> você pode desistir em até{" "}
            {DIAS_PARA_DESISTIR} dias contados do pagamento e recebe de volta o valor pago, sem
            precisar explicar o motivo. É o direito de arrependimento do Código de Defesa do
            Consumidor (Lei 8.078/1990, art. 49). Para pedir, fale com a gente pelo contato no fim
            desta página; a devolução é feita por Pix para quem pagou.
          </li>
          <li>
            Depois desses {DIAS_PARA_DESISTIR} dias, o valor do período já começado não é
            devolvido: você usa até o fim do período pago e não renova.{" "}
            <Revisar>REVISAR COM ADVOGADO: prazo e forma da devolução</Revisar>
          </li>
          <li>
            Mudança de preço vale a partir da renovação seguinte e é avisada com antecedência de{" "}
            <strong>[EXEMPLO: 30 dias]</strong>. No plano anual, o preço fica travado durante os 12
            meses pagos.
          </li>
        </ul>
      </Secao>

      <Secao id="ia" titulo="5. Inteligência artificial">
        <p>
          No plano Completo, três funções usam IA, cada uma com uma franquia por mês, que renova no primeiro dia
          de cada mês e não acumula:
        </p>
        <ul>
          <li>Leitura de documentos: até {LEITURAS_POR_MES_NO_COMPLETO} documentos por mês.</li>
          <li>
            Classificação de custos: até {CLASSIFICACOES_POR_MES_NO_COMPLETO} despesas por mês. As
            regras automáticas não contam.
          </li>
          <li>Assistente: até {PERGUNTAS_POR_MES_NO_COMPLETO} perguntas por mês.</li>
        </ul>
        <p>
          Quando a franquia acaba, só aquela função para até o mês seguinte; o resto do sistema
          continua funcionando. O que a IA lê de um documento só entra nas contas a pagar depois que
          você confere e aceita, item por item. Como os dados vão para a IA está na{" "}
          <Link href="/privacidade#ia" className="font-semibold text-terracota hover:underline">
            Política de privacidade
          </Link>
          .
        </p>
      </Secao>

      <Secao id="responsabilidades" titulo="6. Suas responsabilidades">
        <ul>
          <li>
            Você é o controlador dos dados dos seus clientes e da sua equipe: cadastre só o que
            precisa, tenha uma base legal para isso e atenda os pedidos dessas pessoas.
          </li>
          <li>
            Não registre dados de saúde, diagnóstico nem informação clínica nas observações.
          </li>
          <li>Confira os números e o que a IA sugerir antes de tomar decisões.</li>
          <li>
            As mensagens que você manda pelo WhatsApp são suas. Respeite quem pediu para não receber.
          </li>
          <li>Use o {NOME_DO_PRODUTO} só para atividades legais.</li>
        </ul>
      </Secao>

      <Secao id="links" titulo="7. Link de agendamento e link do contador">
        <ul>
          <li>
            O link de agendamento mostra os horários livres que você abriu e grava o horário na sua
            agenda. Os dados que o cliente digita ficam na sua conta, e você responde por eles como
            controlador.
          </li>
          <li>
            O link do contador funciona como uma senha: quem tiver o link vê os relatórios do mês.
            Mande só para o seu contador e desligue ou troque quando quiser.
          </li>
        </ul>
      </Secao>

      <Secao id="disponibilidade" titulo="8. Disponibilidade e limites">
        <p>
          Trabalhamos para o {NOME_DO_PRODUTO} ficar no ar o tempo todo, mas podem acontecer
          paradas para manutenção ou por falha de fornecedores. Não respondemos por decisões
          tomadas só com base nas estimativas e sugestões do sistema. <Revisar />
        </p>
        <p>
          Podemos suspender a conta que usar o sistema para fins ilegais ou que tente atrapalhar o
          funcionamento dele. <Revisar />
        </p>
      </Secao>

      <Secao id="mudancas" titulo="9. Mudanças, lei e contato">
        <p>
          Quando estes termos mudarem, a data no topo muda junto.{" "}
          <Revisar>REVISAR COM ADVOGADO: forma e prazo de aviso de mudanças</Revisar>
        </p>
        <p>
          Valem as leis do Brasil, incluindo o Código de Defesa do Consumidor quando ele se aplicar.
          Foro: <strong>[EXEMPLO: o do domicílio de quem contrata]</strong>. <Revisar />
        </p>
        <p>
          O {NOME_DO_PRODUTO} é oferecido por <strong>{RESPONSAVEL.nome}</strong>, CPF ou CNPJ{" "}
          <strong>{RESPONSAVEL.documento}</strong>. Contato:{" "}
          {emailDeContatoValido() ? (
            <a
              href={`mailto:${RESPONSAVEL.email}`}
              className="font-semibold text-terracota underline-offset-4 hover:underline"
            >
              {RESPONSAVEL.email}
            </a>
          ) : (
            <strong>{RESPONSAVEL.email}</strong>
          )}
          .
        </p>
      </Secao>
    </PaginaLegal>
  );
}
