# Estado do projeto Bossa

Atualizado em 23/10/2026. Quem retomar o trabalho deve começar por aqui.

## O produto
O Bossa é um SaaS brasileiro de agenda, cobrança e finanças para estúdios (salão, unhas, estética, barbearia, sobrancelha...).
- Stack: Next.js 16 (App Router), Prisma 6 e Postgres no Supabase.
- Login próprio por cookie (`sessao_estudio`, jose). Cada conta é um estúdio, separado por `usuarioId`.
- Tailwind v4 com tokens em `src/app/globals.css` (azul `#1d4ed8` no token `terracota`).

**Planos** (`src/lib/assinatura.ts`; os preços podem ser trocados por variáveis de ambiente):

| Plano | Códigos | Preço |
|---|---|---|
| Simples | `mensal` / `anual` | R$ 189/mês ou R$ 1.890/ano |
| Completo | `vip_mensal` / `vip_anual` | R$ 329/mês ou R$ 2.569/ano |

**Demonstração:** não existe teste grátis. Dá para ver o estúdio de exemplo (somente leitura) de dois jeitos:
- **Sem cadastro** (30/10/2026): os botões "Conhecer o sistema" da página de vendas levam a `/demonstracao`, que grava o cookie `visita_demonstracao` (`src/lib/demonstracao/visita.ts`) e abre o painel com o exemplo. Qualquer escrita leva a `/criar-conta?demonstracao=1`.
- **Com conta criada e sem plano:** qualquer escrita leva à tela de compra.

**Pagamento:** Pix manual. A cliente avisa que pagou e o admin confirma em Pagamentos (`/painel/admin`).

**IA** (assistente, leitura de documentos, classificação de custos): desligada em produção, porque falta `ANTHROPIC_API_KEY`. `recursoLigado()` esconde tudo que depende dela.

## Infraestrutura
- **Site no ar:** https://agendaonlinecontabilidade.netlify.app (Netlify, site id `b20e5c13-1a6f-446f-bd9f-0fdc31f2d791`).
  - O site NÃO está ligado ao GitHub. Os deploys foram feitos pelo Netlify MCP.
  - A versão no ar é de 03/10/2026, ainda com "Testar grátis" e os preços antigos.
- **Bloqueio de rede:** a rede da sessão de nuvem bloqueia `api.netlify.com`, `netlify-mcp.netlify.app` e `*.netlify.app`. Para publicar, é preciso uma destas saídas:
  - (a) o dono ligar o Netlify ao GitHub (Site configuration → Build & deploy → Link repository → my-saas, ramo main). É o recomendado: cada merge na main publica sozinho;
  - (b) o dono liberar esses domínios no ambiente da sessão.
  - Não contornar o bloqueio pelo GitHub Actions: isso já foi recusado pela checagem de segurança.
- **Banco:** Supabase, projeto `rhxyytovecdirveisqjr` (sa-east-1).
  - O plano grátis pausa depois de 7 dias sem uso. `.github/workflows/manter-acordado.yml` chama `/api/saude` todo dia.
  - Produção tinha 4 contas, 1 admin e 3 assinaturas ativas (preço antigo, R$ 169).
- **Variáveis novas para configurar na Netlify** (o dono precisa informar os valores): `CONTATO_EMAIL`, `CONTATO_WHATSAPP`, `RESPONSAVEL_NOME`, `RESPONSAVEL_DOCUMENTO` (CPF/CNPJ, exigido pelo Decreto 7.962/2013) e `ENCARREGADO_DE_DADOS`.
  - Sem elas, as frases de contato somem da tela.
  - Home, termos e privacidade são montados no build: mudar essas variáveis exige publicar de novo.

## O que foi feito em outubro
- PRs #4 a #7, já na main:
  - equipe, custos, assistente, agendamento online, relatório e contador;
  - demonstração e planos novos;
  - página de vendas enxuta;
  - modo custo zero (IA escondida);
  - keep-alive do banco;
  - `/llms.txt` (resumo para as IAs recomendarem o Bossa).
- `docs/divulgacao/`: 4 artes de anúncio (feed 1080x1350 e stories 1080x1920), as fontes HTML e o kit de 30 dias de posts orgânicos. O kit já foi revisado: não promete IA nem teste grátis.
- **Teste pré-lançamento:** 5 testadores com Playwright e um verificador para cada um confirmaram 68 problemas, contando os repetidos.
  - A lista com a correção proposta está em `docs/achados-pre-lancamento.json`, agrupada por área.
  - Os ids são os mesmos usados nos ramos abaixo.

## Correções pré-lançamento (concluídas em 24/10/2026)
- Os 6 ramos `claude/fix-*` foram terminados, revisados (só o diff) e juntados em `claude/pronto-pra-vender`, com as sobras entre grupos resolvidas. PR para a main aberto a partir dele.
- Da revisão saíram mais duas correções: o admin só confirma o Pix com o plano e o valor que viu na tela, e o freio de senhas erradas reserva a tentativa numa transação com trava (pedidos em paralelo não furam o limite).
- Verificado: migrações num banco vazio, lint, tipos, 636 testes, build e conferência no navegador a 390px.
- **Riscos conhecidos, deixados como estão (decisão do dono se quiser mudar):**
  - Receber a cobrança com valor menor (um sinal, por exemplo) troca o preço do atendimento pelo valor recebido.
  - Chave Pix antiga com 11 dígitos que vale como CPF e como celular deixa de gerar código até a dona salvar de novo o tipo em Ajustes.
  - Quem sabe o e-mail de uma dona pode segurar a entrada dela com senhas erradas (o freio por e-mail vale até para a senha certa).
  - Remarcar sem o campo de quem atende não confere férias ou saída da profissional no dia novo.
  - O link público `/agendar/demonstracao-bossa` só existe depois que alguém abre a demonstração pela primeira vez.

## Próximos passos, em ordem
1. Publicar: depende do dono, ver Infraestrutura.
2. Depois de publicar:
   - testar a compra no site no ar;
   - conferir em `/painel/admin` os avisos de Pix "repetidos" que a migração marcou.

## Decisões padrão já tomadas (o dono pode mudar)
- **Troca de plano:** na mesma família, soma os dias; mudando de família com plano ativo, o saldo vira crédito em dinheiro e depois dias no plano novo. Descer de plano vale na hora.
- **Sair:** encerra a conta em todos os aparelhos (sobe `sessaoVersao`).
- **Limite de login:** 5 senhas erradas por e-mail em 24 h, 20 por IP em 1 h; espera de 1 a 15 minutos.
- **Preço:** o atendimento guarda o preço do dia em que foi marcado.
- **Saudação na demonstração:** usa o nome da conta.
- **Termos e privacidade:** os pontos para o advogado ficaram como comentários `REVISAR COM ADVOGADO` no código.
- **Recuperar a senha do admin:** exige o terminal (`npm run senha:link -- email`).

## Pendências do dono
- Contato (e-mail e/ou WhatsApp), nome e CPF/CNPJ para o site e os Termos.
- Ligar o Netlify ao GitHub ou liberar a rede.
- Os 3 assinantes atuais pagam R$ 169: manter esse preço ou subir para R$ 189? (Recomendado: manter até renovarem.)
- Revisão dos Termos por advogado (recomendada).
- Melhoria futura: Pix automático (Mercado Pago ou Asaas, sem mensalidade) no lugar da confirmação manual.

## Ambiente de teste local
- **Postgres local:** `service postgresql start`. O banco de testes é `bossa_mysaas`.
- **`.env` e `.env.teste`:** ficam fora do git. Criar com `DATABASE_URL` e `DIRECT_URL` locais e um `SESSAO_SEGREDO` qualquer.
- **Playwright:** usar o Chromium já instalado, `chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })`. Nunca rodar `playwright install`.
- **Parar servidor:** `kill $(lsof -t -i:PORTA)`. Nunca `pkill -f`, que mata o próprio shell.
