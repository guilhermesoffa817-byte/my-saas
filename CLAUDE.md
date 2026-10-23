# Bossa — regras para o Claude

Antes de qualquer tarefa, leia `docs/estado-do-projeto.md`: o que já foi feito, o que falta e as decisões tomadas.

## Dono
Guilherme. Não é programador, lê pelo celular e escreve em pt-BR informal. Respostas curtas, com o resultado primeiro e sem jargão.

## Economia (pedido do dono)
- Escolha o modelo pela tarefa:
  - **haiku**: buscas, leituras e mudanças mecânicas;
  - **sonnet**: implementação comum e testes;
  - o modelo principal (opus): revisão difícil, desenho de solução e verificação cética.
  Nos subagentes, passe `model` de acordo.
- Ultracode ou workflow com vários agentes são permitidos sem pedir licença ("se precisar de uma melhor ou ultra code pd colocar sem minha permissão"), mas só quando a tarefa pedir mesmo. Prefira 1 ou 2 agentes e teste só o que mudou.
- Nunca refaça um teste completo do sistema sem motivo novo.

## Comandos
- Rodar: `npm run dev` · Lint: `npm run lint` · Tipos: `npx tsc --noEmit` · Testes: `npx vitest run` (banco em `.env.teste`).
- Build: `npx next build`. A Netlify roda `prisma generate && prisma migrate deploy && next build`.
- Next.js 16: `params` e `searchParams` são Promise. Em caso de dúvida, leia `node_modules/next/dist/docs`.

## Regras invioláveis
- Dinheiro em centavos inteiros, nunca float. Na tela, Intl pt-BR/BRL.
- Datas no fuso America/Sao_Paulo.
- Todo dado de estúdio é filtrado por `usuarioId`.
- A demonstração é somente leitura: qualquer escrita leva à compra.
- IA desligada (sem `ANTHROPIC_API_KEY`) não aparece em lugar nenhum: use `recursoLigado()`.
- Contato só por `canaisDeContato()`. Nunca invente e-mail ou telefone.
- Nunca mostre senhas nem segredos no chat. A senha do banco aparece nas variáveis da Netlify: não repita.
- Commits em pt-BR, sem nome de modelo. Push só em ramos `claude/*`; a main só por PR.
- Ao terminar uma tarefa: lint, tipos e testes, e relatar o resultado.
