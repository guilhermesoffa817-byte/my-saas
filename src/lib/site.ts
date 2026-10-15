import { somarDias } from "@/lib/formato";
import { podeUsar } from "@/lib/recursos";

/**
 * Dados do site usados pelo Google e pelas redes sociais.
 *
 * Fica tudo num arquivo só porque o endereço aparece em vários lugares: nos
 * dados estruturados, no sitemap, no robots e na imagem de capa. Se um dia você
 * comprar um domínio próprio, muda a variável ENDERECO_DO_SITE na Netlify e
 * todo o resto acompanha sozinho.
 */

export const ENDERECO_DO_SITE = (
  process.env.ENDERECO_DO_SITE ?? "https://agendaonlinecontabilidade.netlify.app"
).replace(/\/+$/, "");

export const NOME_DO_PRODUTO = "Bossa";

/** O que vai depois do nome no título da aba e no resultado da busca. */
export const TITULO_PADRAO = `${NOME_DO_PRODUTO} · sistema de agendamento para estúdios`;

/** A frase que acompanha o nome em todo lugar. */
export const FRASE_DA_MARCA =
  "sua agenda online que cuida do seu dia e do seu dinheiro";

/**
 * Os ramos que o sistema atende. Aparecem escritos na página, porque é assim
 * que o Google entende do que o site trata, e porque é a primeira pergunta de
 * quem chega: "isso serve pro meu negócio?".
 */
export const SEGMENTOS = [
  "estética",
  "barbearia",
  "salão de beleza",
  "unhas",
  "sobrancelha",
  "tatuagem",
  "massagem",
  "odontologia",
  "fisioterapia",
];

/**
 * O que uma dona de estúdio digita no Google quando procura uma solução.
 * O Google não lê mais a etiqueta de palavras-chave, mas o Bing e vários
 * buscadores menores leem, e não custa nada manter.
 */
export const PALAVRAS_CHAVE = [
  "sistema de agendamento",
  "agenda online",
  "agenda online para estúdio",
  "sistema de agendamento para salão de beleza",
  "sistema de agendamento para barbearia",
  "software para clínica de estética",
  "programa para marcar horário de cliente",
  "aplicativo de agendamento de clientes",
  "cadastro de clientes e agendamentos",
  "controle financeiro para salão",
  "agenda digital para autônomo",
  "gestão para estúdio de beleza",
  "sistema para studio de unhas",
  "agendamento online para estúdio de tatuagem",
];

export const DESCRICAO_CURTA =
  "Bossa é a agenda online que cuida do seu dia e do seu dinheiro: agenda da semana, ficha de clientes, serviços e faturamento num lugar só. Teste grátis, sem cartão.";

/**
 * As páginas abertas a qualquer visitante, na ordem em que importam para o
 * Google. O sitemap sai daqui, então página pública nova entra nesta lista e
 * não precisa ser lembrada em outro lugar. O resto do site fica atrás do login.
 */
export const PAGINAS_PUBLICAS: {
  caminho: string;
  frequencia: "weekly" | "monthly" | "yearly";
  prioridade: number;
}[] = [
  { caminho: "/", frequencia: "weekly", prioridade: 1 },
  { caminho: "/criar-conta", frequencia: "monthly", prioridade: 0.8 },
  { caminho: "/entrar", frequencia: "yearly", prioridade: 0.3 },
  { caminho: "/termos", frequencia: "yearly", prioridade: 0.2 },
  { caminho: "/privacidade", frequencia: "yearly", prioridade: 0.2 },
];

/**
 * Se o teste grátis já libera os recursos do VIP. O site e os termos dizem isso
 * por escrito, então a resposta vem da própria regra de lib/recursos.ts, com uma
 * conta em teste no plano VIP, em vez de uma frase fixa que envelhece calada no
 * dia em que a regra mudar.
 */
export function testeLiberaOVip(agora = new Date()) {
  const contaEmTeste = {
    assinatura: { status: "teste", plano: "vip_mensal", validaAte: somarDias(agora, 1) },
  };
  return podeUsar(contaEmTeste, "financas", agora);
}
