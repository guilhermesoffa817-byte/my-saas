export const NEGOCIO = {
  nome: "Raissa Soffa",
  cidade: "Sinop",
  bairro: "[BAIRRO]",
  numeroInternacional: "5566992513501",
  numeroExibicao: "(66) 99251-3501",
} as const;

export const MENSAGEM_WHATSAPP =
  "Olá, vi a página da Raissa Soffa e quero saber mais sobre a automação de WhatsApp";

/** Link usado em todos os CTAs principais da página. */
export const LINK_WHATSAPP = `https://wa.me/${NEGOCIO.numeroInternacional}?text=${encodeURIComponent(
  MENSAGEM_WHATSAPP,
)}`;

export const ITENS_MENU = [
  { href: "#automatiza", rotulo: "O que automatiza" },
  { href: "#integracao", rotulo: "Integração oficial" },
  { href: "#demonstracao", rotulo: "Demonstração" },
  { href: "#planos", rotulo: "Planos" },
] as const;

export const AUTOMACOES = [
  {
    titulo: "Resposta imediata fora do horário",
    resumo:
      "Mensagem que chega às 22h, no domingo ou no meio do feriado é respondida na hora.",
    texto:
      "Quem manda mensagem fora do expediente recebe resposta na mesma hora: preço, endereço, formas de pagamento, horário de funcionamento e o que mais você quiser deixar pronto. O contato fica registrado e a sua equipe abre o dia seguinte com a conversa já encaminhada, em vez de uma fila de mensagens antigas.",
    itens: [
      "Respostas escritas em cima do que o seu negócio realmente vende",
      "Aviso de quando um atendente assume no próximo horário útil",
      "Nada de cliente esperando até segunda-feira por um preço",
    ],
  },
  {
    titulo: "Distribuição de conversa entre atendentes",
    resumo:
      "Um número só para o cliente, várias pessoas atendendo do outro lado.",
    texto:
      "As conversas são divididas entre os atendentes por rodízio ou por assunto — vendas, orçamento, suporte, financeiro. Cada conversa tem um responsável visível, então ninguém responde em cima do outro e nenhuma mensagem fica parada esperando alguém lembrar dela.",
    itens: [
      "Fila dividida automaticamente entre a equipe",
      "Histórico completo da conversa para quem assumir",
      "Você enxerga quem está atendendo o quê em tempo real",
    ],
  },
  {
    titulo: "Reengajamento automático de contato parado",
    resumo: "Quem perguntou o preço e sumiu recebe uma mensagem de volta.",
    texto:
      "Depois do tempo que você definir, o contato que parou no meio da conversa recebe uma mensagem de retomada — no tom que você aprovar, sem insistência. É o dinheiro que já estava quase fechado voltando para a fila em vez de virar venda do concorrente.",
    itens: [
      "Prazo e texto da retomada definidos por você",
      "Parada automática assim que o cliente responde",
      "Contato devolvido para um atendente humano quando reagir",
    ],
  },
] as const;

export const PLANOS = [
  {
    nome: "Essencial",
    preco: "[PRECO PLANO BASICO]",
    para: "Para quem atende sozinho ou com um ajudante e só não quer mais perder mensagem.",
    destaque: false,
    etiqueta: "",
    itens: [
      "Número na API oficial da Meta",
      "Atendimento automático 24 horas com as perguntas mais repetidas do seu negócio",
      "Resposta imediata fora do horário e nos fins de semana",
      "1 atendente humano no painel",
      "Transferência do robô para humano a qualquer momento",
      "Configuração inicial feita pela nossa equipe",
    ],
  },
  {
    nome: "Equipe",
    preco: "[PRECO PLANO INTERMEDIARIO]",
    para: "Para o negócio que já tem mais de uma pessoa respondendo no mesmo número.",
    destaque: true,
    etiqueta: "Indicado para equipe",
    itens: [
      "Tudo do plano Essencial",
      "Distribuição automática das conversas entre os atendentes",
      "Até 5 atendentes humanos no painel",
      "Fila por assunto: vendas, orçamento, suporte",
      "Reengajamento automático de contato parado",
      "Relatório mensal de conversas atendidas e retomadas",
    ],
  },
  {
    nome: "Completo",
    preco: "[PRECO PLANO AVANCADO]",
    para: "Para quem tem volume alto de mensagem e precisa do atendimento rodando redondo o mês inteiro.",
    destaque: false,
    etiqueta: "",
    itens: [
      "Tudo do plano Equipe",
      "Atendentes ilimitados no painel",
      "Fluxos de conversa sob medida para cada serviço ou produto",
      "Campanhas de retomada com mais de uma tentativa",
      "Integração com a sua planilha ou sistema de pedidos",
      "Ajustes de fluxo e acompanhamento mensal com a nossa equipe",
    ],
  },
] as const;
