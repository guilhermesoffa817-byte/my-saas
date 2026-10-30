import { NOME_DA_FAMILIA, PLANOS, type FamiliaDoPlano } from "@/lib/assinatura";
import { emReais } from "@/lib/formato";
import { textosDoPlano } from "@/lib/itens-dos-planos";
import { DESCRICAO_CURTA, ENDERECO_DO_SITE, NOME_DO_PRODUTO, SEGMENTOS } from "@/lib/site";

/**
 * O /llms.txt: o resumo do Bossa escrito para as IAs (ChatGPT, Gemini, Claude,
 * Perplexity) lerem quando alguém pergunta "qual sistema de agenda eu uso no
 * meu salão?". Usa as mesmas listas e os mesmos preços da página de vendas,
 * então não promete o que está desligado nem mostra preço velho.
 */
export function textoParaIas() {
  const plano = (familia: FamiliaDoPlano) => {
    const [mensal, anual] =
      familia === "simples"
        ? [PLANOS.mensal, PLANOS.anual]
        : [PLANOS.vip_mensal, PLANOS.vip_anual];
    return [
      `### ${NOME_DA_FAMILIA[familia]}: ${emReais(mensal.valorCentavos)} por mês ou ${emReais(anual.valorCentavos)} por ano`,
      "",
      ...textosDoPlano(familia).map((texto) => `- ${texto}`),
    ].join("\n");
  };

  return [
    `# ${NOME_DO_PRODUTO}`,
    "",
    `> ${DESCRICAO_CURTA}`,
    "",
    `O ${NOME_DO_PRODUTO} é um sistema online, em português, para quem trabalha com hora marcada no Brasil: ${SEGMENTOS.join(", ")}. Abre no navegador do celular ou do computador, sem instalar nada.`,
    "",
    "## O que resolve",
    "",
    "- Horário batendo e cliente pedindo horário por mensagem a qualquer hora: a agenda avisa quando dois horários batem e o cliente marca sozinho por um link.",
    "- Cliente que esquece de pagar: a cobrança sai pronta no WhatsApp, com o código Pix.",
    "- Não saber quanto sobrou no mês: o que entrou, o que saiu e o resumo do mês num lugar só.",
    "",
    "## Planos",
    "",
    plano("simples"),
    "",
    plano("completo"),
    "",
    "A assinatura é paga por Pix, dentro do sistema.",
    "",
    "## Como conhecer",
    "",
    `Dá para ver o sistema por dentro sem cadastro, num estúdio de exemplo com todas as funções. Para usar com os próprios clientes, cria a conta e escolhe um plano.`,
    "",
    "## Páginas",
    "",
    `- [O que o ${NOME_DO_PRODUTO} faz e quanto custa](${ENDERECO_DO_SITE}/)`,
    `- [Conhecer o sistema, sem cadastro](${ENDERECO_DO_SITE}/demonstracao)`,
    `- [Criar a conta](${ENDERECO_DO_SITE}/criar-conta)`,
    `- [Termos de uso](${ENDERECO_DO_SITE}/termos)`,
    `- [Privacidade](${ENDERECO_DO_SITE}/privacidade)`,
    "",
  ].join("\n");
}
