-- Um só aviso de Pix esperando conferência por conta.
--
-- Antes, duas abas abertas na assinatura (ou dois toques rápidos) gravavam dois
-- avisos iguais, e cada confirmação do admin somava mais dias por um Pix só.
-- Agora o banco não aceita um segundo aviso "aguardando" na mesma conta; quem
-- troca de plano com um aviso esperando atualiza o aviso que já existe.
--
-- 1) Os avisos repetidos que já existem: fica o mais novo de cada conta (é a
--    última escolha da pessoa) e os outros passam a "repetido", com a data de
--    hoje como resposta. Nada é apagado: o histórico continua mostrando todos.
--    Rodar de novo não muda nada, porque depois disso só sobra um por conta.
UPDATE "Pagamento" AS p
SET "status" = 'repetido',
    "respondidoEm" = now()
WHERE p."status" = 'aguardando'
  AND EXISTS (
    SELECT 1
    FROM "Pagamento" AS q
    WHERE q."usuarioId" = p."usuarioId"
      AND q."status" = 'aguardando'
      AND (q."criadoEm" > p."criadoEm" OR (q."criadoEm" = p."criadoEm" AND q."id" > p."id"))
  );

-- 2) A regra, no banco: índice único parcial, só sobre os avisos esperando.
--    O Prisma 6 não descreve índice parcial no schema.prisma; por isso ele mora
--    só aqui. Se um dia `prisma migrate dev` sugerir apagar este índice, tire
--    o DROP INDEX da migração gerada.
CREATE UNIQUE INDEX "Pagamento_um_aguardando_por_conta"
ON "Pagamento" ("usuarioId")
WHERE "status" = 'aguardando';
