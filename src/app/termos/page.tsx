import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal, Secao, numerarSecoes, type ItemDoSumario } from "@/componentes/pagina-legal";
import { PLANOS, economiaDoAnual } from "@/lib/assinatura";
import { DIAS_PARA_DESISTIR } from "@/lib/leis";
import { canaisDeContato, dadosDoResponsavel } from "@/lib/contato";
import { emReais } from "@/lib/formato";
import {
  CLASSIFICACOES_POR_MES_NO_COMPLETO,
  LEITURAS_POR_MES_NO_COMPLETO,
  PERGUNTAS_POR_MES_NO_COMPLETO,
  RECURSOS,
  recursoLigado,
  soNoCompleto,
  type Recurso,
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
 * da página de vendas. Preços, planos e franquias vêm das mesmas constantes que
 * o sistema usa, para nunca desencontrarem.
 *
 * O que depende de recurso desligado neste servidor (a inteligência artificial
 * sem a chave da Anthropic, por exemplo) some do texto, como some da página de
 * vendas: o contrato não promete o que não funciona. A página é montada no
 * build, com as chaves da publicação.
 *
 * Os pontos que ainda pedem revisão jurídica estão em comentário, com
 * "REVISAR COM ADVOGADO", e não aparecem na tela.
 */

/** Como cada recurso aparece no contrato. A ordem é a de lib/recursos.ts. */
const NO_CONTRATO: Record<Recurso, string> = {
  cobrar: "cobranças pelo WhatsApp com código Pix",
  lembretes: "lembretes de cobrança",
  vencimentos: "contas a pagar",
  documentos: "leitura de documentos por IA",
  financas: "finanças (entradas, saídas, resumo do mês e imposto estimado)",
  relatorio: "relatório e fechamento do mês com link do contador",
  equipe: "equipe",
  custos: "custos",
  assistente: "assistente",
};

/** "a, b e c". */
function emLista(itens: string[]) {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

const POR_EXTENSO = ["nenhuma", "uma", "duas", "três"];

export default function PaginaTermos() {
  const leitura = recursoLigado("documentos");
  const assistente = recursoLigado("assistente");
  // A classificação de custos usa a mesma chave da IA que o assistente.
  const classificacao = assistente;
  const comIa = leitura || assistente || classificacao;

  const funcoesDeIa = [
    leitura && "leitura de documentos",
    classificacao && "classificação de custos",
    assistente && "assistente",
  ].filter((funcao): funcao is string => Boolean(funcao));

  const doSimples = [
    "agenda",
    "link de agendamento",
    "ficha de clientes",
    "serviços",
    ...RECURSOS.filter((recurso) => !soNoCompleto(recurso) && recursoLigado(recurso)).map(
      (recurso) => NO_CONTRATO[recurso],
    ),
  ];
  const doCompleto = RECURSOS.filter((recurso) => soNoCompleto(recurso) && recursoLigado(recurso)).map(
    (recurso) => NO_CONTRATO[recurso],
  );

  const responsavel = dadosDoResponsavel();
  const temContato = canaisDeContato().length > 0;

  const sumario: ItemDoSumario[] = [
    { id: "o-que-faz", titulo: "O que o Bossa faz" },
    { id: "nao-faz", titulo: "O que o Bossa não faz" },
    { id: "conta", titulo: "Sua conta" },
    { id: "assinatura", titulo: "Demonstração, assinatura e garantia" },
    ...(comIa ? [{ id: "ia", titulo: "Inteligência artificial" }] : []),
    { id: "responsabilidades", titulo: "Suas responsabilidades" },
    { id: "links", titulo: "Link de agendamento e link do contador" },
    { id: "disponibilidade", titulo: "Disponibilidade e limites" },
    {
      id: "mudancas",
      titulo: responsavel.nome ? `Mudanças, lei e quem oferece o ${NOME_DO_PRODUTO}` : "Mudanças e lei",
    },
  ];
  const titulo = numerarSecoes(sumario);

  return (
    <PaginaLegal
      pagina="termos"
      titulo="Termos de uso"
      atualizadaEm="19 de outubro de 2026"
      sumario={sumario}
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
            {comIa ? (
              <li>O que a IA sugere é informativo e pode ter erro. Confira antes de usar.</li>
            ) : null}
          </ul>
        </>
      }
    >
      <Secao id="o-que-faz" titulo={titulo("o-que-faz")}>
        <p>
          O {NOME_DO_PRODUTO} é um sistema na internet para estúdios e profissionais que atendem com
          hora marcada. Ao aceitar estes termos, você pode usá-lo conforme o plano que escolher:
        </p>
        <ul>
          <li>
            <strong>Simples:</strong> {emLista(doSimples)}.
          </li>
          <li>
            <strong>Completo:</strong> tudo do Simples, mais {emLista(doCompleto)}.
          </li>
        </ul>
      </Secao>

      <Secao id="nao-faz" titulo={titulo("nao-faz")}>
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
          {comIa ? (
            <li>
              As sugestões da IA ({emLista(funcoesDeIa)}) são informativas, podem conter erros e não
              são consultoria.
            </li>
          ) : null}
        </ul>
      </Secao>

      <Secao id="conta" titulo={titulo("conta")}>
        <ul>
          <li>Cada conta é de um estúdio. Use dados verdadeiros no cadastro.</li>
          <li>
            Guarde a sua senha. O que for feito com ela é responsabilidade de quem tem a conta.
          </li>
          <li>
            Para criar a conta é preciso ter 18 anos ou mais e poder contratar em nome do negócio.
            {/* REVISAR COM ADVOGADO: idade mínima e capacidade para contratar. */}
          </li>
        </ul>
      </Secao>

      <Secao id="assinatura" titulo={titulo("assinatura")}>
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
            Consumidor (Lei 8.078/1990, art. 49).{" "}
            {temContato ? (
              <>
                Para pedir, fale com a gente pelo{" "}
                <a
                  href="#fale-com-a-gente"
                  className="font-semibold text-terracota underline-offset-4 hover:underline"
                >
                  contato no fim desta página
                </a>
                ; a devolução é feita por Pix para quem pagou.
              </>
            ) : (
              <>A devolução é feita por Pix para quem pagou.</>
            )}
          </li>
          <li>
            Depois desses {DIAS_PARA_DESISTIR} dias, o valor do período já começado não é
            devolvido: você usa até o fim do período pago e não renova.
            {/* REVISAR COM ADVOGADO: prazo e forma da devolução. */}
          </li>
          <li>
            Mudança de preço vale a partir da renovação seguinte e é avisada com antecedência de{" "}
            <strong>30 dias</strong>. No plano anual, o preço fica travado durante os 12 meses pagos.
          </li>
        </ul>
      </Secao>

      {comIa ? (
        <Secao id="ia" titulo={titulo("ia")}>
          <p>
            No plano Completo, {POR_EXTENSO[funcoesDeIa.length]}{" "}
            {funcoesDeIa.length === 1 ? "função usa" : "funções usam"} IA, cada uma com uma
            franquia por mês, que renova no primeiro dia de cada mês e não acumula:
          </p>
          <ul>
            {leitura ? (
              <li>Leitura de documentos: até {LEITURAS_POR_MES_NO_COMPLETO} documentos por mês.</li>
            ) : null}
            {classificacao ? (
              <li>
                Classificação de custos: até {CLASSIFICACOES_POR_MES_NO_COMPLETO} despesas por mês.
                As regras automáticas não contam.
              </li>
            ) : null}
            {assistente ? (
              <li>Assistente: até {PERGUNTAS_POR_MES_NO_COMPLETO} perguntas por mês.</li>
            ) : null}
          </ul>
          <p>
            Quando a franquia acaba, só aquela função para até o mês seguinte; o resto do sistema
            continua funcionando.{" "}
            {leitura
              ? "O que a IA lê de um documento só entra nas contas a pagar depois que você confere e aceita, item por item. "
              : null}
            Como os dados vão para a IA está na{" "}
            <Link href="/privacidade#ia" className="font-semibold text-terracota hover:underline">
              Política de privacidade
            </Link>
            .
          </p>
        </Secao>
      ) : null}

      <Secao id="responsabilidades" titulo={titulo("responsabilidades")}>
        <ul>
          <li>
            Você é o controlador dos dados dos seus clientes e da sua equipe: cadastre só o que
            precisa, tenha uma base legal para isso e atenda os pedidos dessas pessoas.
          </li>
          <li>
            Não registre dados de saúde, diagnóstico nem informação clínica nas observações.
          </li>
          <li>Confira os números e as sugestões do sistema antes de tomar decisões.</li>
          <li>
            As mensagens que você manda pelo WhatsApp são suas. Respeite quem pediu para não receber.
          </li>
          <li>Use o {NOME_DO_PRODUTO} só para atividades legais.</li>
        </ul>
      </Secao>

      <Secao id="links" titulo={titulo("links")}>
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

      <Secao id="disponibilidade" titulo={titulo("disponibilidade")}>
        <p>
          Trabalhamos para o {NOME_DO_PRODUTO} ficar no ar o tempo todo, mas podem acontecer
          paradas para manutenção ou por falha de fornecedores. Não respondemos por decisões
          tomadas só com base nas estimativas e sugestões do sistema.
          {/* REVISAR COM ADVOGADO: limite de responsabilidade. */}
        </p>
        <p>
          Podemos suspender a conta que usar o sistema para fins ilegais ou que tente atrapalhar o
          funcionamento dele.
          {/* REVISAR COM ADVOGADO: hipóteses e aviso de suspensão. */}
        </p>
      </Secao>

      <Secao id="mudancas" titulo={titulo("mudancas")}>
        <p>
          Quando estes termos mudarem, a data no topo muda junto.
          {/* REVISAR COM ADVOGADO: forma e prazo de aviso de mudanças. */}
        </p>
        <p>
          Valem as leis do Brasil, incluindo o Código de Defesa do Consumidor quando ele se aplicar.
          Foro: o do domicílio de quem contrata.
        </p>
        {/* RESPONSAVEL_NOME e RESPONSAVEL_DOCUMENTO vêm do ambiente (Decreto 7.962/2013, art. 2º). */}
        {responsavel.nome ? (
          <p>
            O {NOME_DO_PRODUTO} é oferecido por <strong>{responsavel.nome}</strong>
            {responsavel.documento ? (
              <>
                , CPF ou CNPJ <strong>{responsavel.documento}</strong>
              </>
            ) : null}
            .
          </p>
        ) : null}
        {/* O contato fica logo abaixo, no fim da página (PaginaLegal), e no rodapé. */}
      </Secao>
    </PaginaLegal>
  );
}
