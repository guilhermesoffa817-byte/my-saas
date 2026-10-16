-- Corrige o dia das saídas e entradas criadas ao pagar um vencimento ou
-- receber uma cobrança solta.
--
-- Esses lançamentos eram gravados com o dia puro (meia-noite em UTC), que em
-- São Paulo é 21h do dia anterior: a conta paga no dia 10 aparecia nas
-- Finanças no dia 9, e a paga no dia 1º caía no mês anterior.
--
-- Só mexe em lançamento que (1) nasceu de um vencimento ou de uma cobrança e
-- (2) está exatamente à meia-noite em UTC, que é a marca do erro. Depois da
-- correção ele fica às 03:00 UTC (meia-noite em São Paulo), então rodar de novo
-- não muda nada. Nenhuma coluna é criada, alterada ou apagada.
UPDATE "Lancamento" AS l
SET "data" = ((l."data"::date)::timestamp AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'UTC'
WHERE l."data"::time = TIME '00:00:00'
  AND (
    EXISTS (SELECT 1 FROM "Vencimento" v WHERE v."lancamentoId" = l."id")
    OR EXISTS (SELECT 1 FROM "Cobranca" c WHERE c."lancamentoId" = l."id")
  );
