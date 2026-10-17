# Bossa — instruções para o Claude Code

O Bossa é o SaaS do Guilherme: agenda online, cobrança pelo WhatsApp com Pix, vencimentos, documentos lidos por IA e financeiro, para autônomos e pequenos negócios (estúdios, salões, clínicas, personal trainers). No ar em https://agendaonlinecontabilidade.netlify.app

## Como trabalhar com o Guilherme

- Fale sempre em português do Brasil, simples e direto. Isso vale também para os agentes da pasta `.claude/agents`, mesmo que as instruções deles estejam em inglês.
- Ele está começando e diz ter pouco conhecimento técnico: explique com cuidado o que vai fazer e por quê, sem jargão, e diga exatamente o que ele precisa fazer.
- Peça permissão antes de: mudar muita coisa de uma vez, apagar arquivos ou dados, criar migração do banco, mexer em variáveis de ambiente ou publicar.
- Economize: faça o menor conjunto de mudanças que resolve o pedido e não mexa no que não foi pedido.
- Ao terminar, diga em poucas linhas o que mudou, o que foi testado e qual é o próximo passo dele.

## Como o projeto é feito

- Next.js 16 (App Router e server actions), React 19 e TypeScript.
- Prisma 6 com PostgreSQL no Supabase. O cliente é gerado em `src/generated/prisma` e não vai para o git.
- Login com cookie próprio assinado (`src/lib/sessao.ts`). Quem pode ver o quê fica em `src/lib/guardas.ts`.
- Nomes de arquivos, funções e variáveis em português. Siga o mesmo padrão.
- Dinheiro sempre em centavos inteiros (campos como `valorCentavos` e `precoCentavos`). Formate só na tela.
- Datas aparecem no fuso `America/Sao_Paulo` (`src/lib/formato.ts`).
- Segredos ficam no `.env` (fora do git) e nas variáveis da Netlify; os nomes estão em `.env.example`. Nunca coloque chave nem senha no código.

## Comandos

- `npm install`: instala tudo e gera o cliente do banco
- `npm run dev`: abre em http://localhost:3000
- `npm run tipos`: confere os tipos
- `npm run lint`: confere o padrão do código
- `npm run teste`: testes (Vitest). Os de banco precisam de `.env.teste` com um Postgres local e são pulados sem ele.
- `npm run build`: versão de produção

## Antes de dizer que terminou

Rode `npm run tipos`, `npm run lint` e `npm run teste`. Se mexeu em telas, rotas ou configuração, rode também `npm run build`. Conte o resultado de cada um. O agente `conferente-bossa` faz essa conferência.

## Publicação (cuidado)

- A Netlify publica a branch `main`. O build roda `prisma migrate deploy` no banco de produção antes do `next build` (veja `netlify.toml`).
- Trabalhe numa branch e abra pull request. Não empurre direto para `main` sem o Guilherme pedir.
- Migração nova muda o banco de produção na próxima publicação. Explique antes e peça permissão.
- Mudança que não mexe no app (documentação, `.claude/`) pode levar `[skip netlify]` na mensagem do commit e no título do pull request, para não gerar publicação.

## Agentes do projeto (`.claude/agents`)

- Programação: Frontend Developer, Backend Architect, Database Optimizer, Minimal Change Engineer, Code Reviewer
- Conferência: conferente-bossa
- Anúncios: PPC Campaign Strategist (Google Ads), Paid Social Strategist (Meta Ads), Ad Creative Strategist, Tracking & Measurement Specialist
- Conteúdo e crescimento: TikTok Strategist, Content Creator, Growth Hacker, SEO Specialist
- Produto e atendimento: Sprint Prioritizer, Support Responder

Todos, menos o `conferente-bossa`, vêm do projeto Agency Agents (licença MIT). Origem e licença em `.claude/terceiros/agency-agents/`.
