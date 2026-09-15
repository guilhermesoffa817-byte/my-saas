# Ateliê — sistema para estúdios de estética

Um SaaS simples e acolhedor para quem cuida de pessoas: agenda, ficha das clientes,
serviços, faturamento do mês e uma assinatura mensal de **R$ 260,00** paga por **Pix**.

## O que já está pronto

- **Site de apresentação** com o plano, a chave Pix e as dúvidas mais comuns.
- **Conta própria para cada estúdio**, com 7 dias de teste ao se cadastrar.
- **Agenda por dia**, com aviso quando um horário esbarra em outro atendimento.
- **Clientes**: contato, aniversário e observações (alergias, preferências...).
- **Serviços**: preço e duração, que já aparecem prontos na hora de agendar.
- **Painel** com atendimentos do dia, concluídos no mês e faturamento calculado sozinho.
- **Assinatura por Pix**: QR Code, chave para copiar, aviso de pagamento com um clique
  e histórico dos meses.
- **Área de administração** para conferir os Pix recebidos, liberar mais 30 dias de
  acesso e dar cortesia quando fizer sentido.

## Como rodar na sua máquina

```bash
npm install                 # instala tudo e gera o cliente do banco
cp .env.example .env        # ajuste as variáveis (principalmente SESSAO_SEGREDO)
npx prisma migrate deploy   # cria o banco
npm run seed                # cria a conta de administração e um estúdio de exemplo
npm run dev                 # abre em http://localhost:3000
```

Contas criadas pelo `npm run seed`:

| Acesso          | E-mail                    | Senha              |
| --------------- | ------------------------- | ------------------ |
| Administração   | `admin@meuestudio.com.br` | `mudeessasenha123` |
| Estúdio exemplo | `demo@meuestudio.com.br`  | `demo12345`        |

> Troque essas senhas antes de colocar no ar. O e-mail e a senha da administração saem
> das variáveis `ADMIN_EMAIL` e `ADMIN_SENHA`.

## Como funciona a cobrança

1. A assinante abre **Assinatura** no painel e vê o valor, o QR Code e a chave Pix.
2. Ela faz o Pix e clica em **Já fiz o Pix** (pode deixar um recado, se quiser).
3. O aviso aparece na área **Pagamentos** para quem administra o sistema.
4. Ao clicar em **Confirmar e liberar 30 dias**, o acesso é renovado — e os dias que
   ainda sobravam não se perdem, eles entram na conta.

Enquanto o Pix está sendo conferido, o painel mostra um recado de espera em vez de
cobrança. Se a assinatura vence, o acesso fica limitado à tela de assinatura, mas
**nenhum dado é apagado**: tudo volta como estava assim que o pagamento é confirmado.

### Mudar o valor ou a chave Pix

Está tudo no `.env`:

```env
PIX_CHAVE="66992513501"
PIX_NOME="Estúdio de Estética"
ASSINATURA_VALOR_CENTAVOS="26000"   # 26000 centavos = R$ 260,00
```

> A chave entra no QR Code exatamente como estiver escrita aqui. Use o mesmo formato
> que está cadastrado no banco — chaves de telefone costumam ser registradas como
> `+5566992513501`, enquanto CPF, e-mail e chave aleatória vão do jeito que são.

## Comandos

| Comando         | Para que serve                                  |
| --------------- | ----------------------------------------------- |
| `npm run dev`   | Sobe o sistema em modo de desenvolvimento       |
| `npm run build` | Gera a versão de produção                        |
| `npm run start` | Roda a versão de produção                        |
| `npm run lint`  | Confere o padrão do código                       |
| `npm run seed`  | Cria/atualiza a conta de administração e o exemplo |

## Como está organizado

```
prisma/schema.prisma   modelo do banco (usuários, assinaturas, pagamentos, agenda)
src/app/               páginas e ações do servidor
  painel/agenda        agenda do dia e marcação de horários
  painel/clientes      ficha das clientes
  painel/servicos      cardápio de serviços
  painel/assinatura    Pix, QR Code e histórico de pagamentos
  painel/admin         conferência dos Pix recebidos
src/lib/               sessão, regras da assinatura, Pix e formatação
src/componentes/       botões, avisos e marca
```

Feito com Next.js, Prisma e SQLite. Para usar outro banco (PostgreSQL, por exemplo),
troque o `provider` no `prisma/schema.prisma` e o `DATABASE_URL` no `.env`.
