/**
 * Os destinos do painel, num lugar só.
 *
 * A barra de baixo cabe cinco itens no celular. O que passar disso vai para a
 * tela "Mais", e é por isso que esta lista existe separada das telas: a barra e
 * o "Mais" leem a mesma fonte, então nenhum destino some sem querer.
 */

export type Destino = {
  href: string;
  rotulo: string;
  /** Uma linha explicando, mostrada só na tela "Mais". */
  explicacao: string;
  icone: string;
  /** Quando true, só aparece para quem tem plano com financeiro. */
  vip?: boolean;
  /** Quando true, só aparece para a administração do Bossa. */
  admin?: boolean;
};

/** Os quatro primeiros da barra de baixo. O quinto é sempre "Mais". */
export const PRINCIPAIS: Destino[] = [
  {
    href: "/painel",
    rotulo: "Início",
    explicacao: "O que precisa de você hoje.",
    icone: "casa",
  },
  {
    href: "/painel/agenda",
    rotulo: "Agenda",
    explicacao: "Os horários da semana.",
    icone: "calendario",
  },
  {
    href: "/painel/cobrancas",
    rotulo: "Cobranças",
    explicacao: "O que você tem a receber dos seus clientes.",
    icone: "dinheiro",
  },
  {
    href: "/painel/clientes",
    rotulo: "Clientes",
    explicacao: "A ficha de cada pessoa que você atende.",
    icone: "pessoas",
  },
];

/** O resto, que vive na tela "Mais". */
export const SECUNDARIOS: Destino[] = [
  {
    href: "/painel/servicos",
    rotulo: "Serviços",
    explicacao: "O que você oferece, com preço e duração.",
    icone: "etiqueta",
  },
  {
    href: "/painel/vencimentos",
    rotulo: "Vencimentos",
    explicacao: "Contas a pagar e prazos de contrato.",
    icone: "sino",
    vip: true,
  },
  {
    href: "/painel/documentos",
    rotulo: "Documentos",
    explicacao: "Envie um contrato ou uma conta e o Bossa lê para você.",
    icone: "papel",
    vip: true,
  },
  {
    href: "/painel/financas",
    rotulo: "Finanças",
    explicacao: "O que entra, o que sai e o imposto estimado.",
    icone: "grafico",
    vip: true,
  },
  {
    href: "/painel/assinatura",
    rotulo: "Assinatura",
    explicacao: "Seu plano e a forma de pagar.",
    icone: "cartao",
  },
  {
    href: "/painel/admin",
    rotulo: "Pagamentos",
    explicacao: "Conferir os Pix recebidos das assinaturas.",
    icone: "chave",
    admin: true,
  },
];

export function destinosVisiveis(
  lista: Destino[],
  { financeiro, admin }: { financeiro: boolean; admin: boolean },
) {
  return lista.filter((item) => {
    if (item.vip && !financeiro) return false;
    if (item.admin && !admin) return false;
    return true;
  });
}
