-- O preço do atendimento passa a ficar guardado no próprio horário.
--
-- Antes, Finanças, Custos, Relatório, Equipe e Início somavam o preço ATUAL do
-- serviço: mudar o preço de "Mega hair" de R$ 1.234,56 para R$ 1.300,00 mudava
-- também o faturamento dos atendimentos já concluídos. Agora cada horário
-- guarda o preço da época em que foi marcado, e o valor recebido quando ele é
-- cobrado e pago (ver lib/cobranca-operacoes.ts).
ALTER TABLE "Agendamento" ADD COLUMN "precoCentavos" INTEGER;

-- Os horários que já existem ficam com o preço de hoje do serviço, que é o
-- mesmo número que as telas mostravam até aqui: nada muda para ninguém.
UPDATE "Agendamento" AS a
SET "precoCentavos" = s."precoCentavos"
FROM "Servico" AS s
WHERE s."id" = a."servicoId"
  AND a."precoCentavos" IS NULL;

-- Rede de segurança no próprio banco: horário gravado sem preço (por um
-- caminho que esqueceu de mandar, um teste, a semente da demonstração) recebe
-- o preço do serviço naquele instante. E se um dia o serviço do horário for
-- trocado sem mandar preço novo, o preço acompanha o serviço novo.
CREATE OR REPLACE FUNCTION "preco_do_atendimento"() RETURNS trigger AS $$
BEGIN
  IF NEW."precoCentavos" IS NULL
     OR (TG_OP = 'UPDATE'
         AND NEW."servicoId" IS DISTINCT FROM OLD."servicoId"
         AND NEW."precoCentavos" IS NOT DISTINCT FROM OLD."precoCentavos") THEN
    SELECT s."precoCentavos" INTO NEW."precoCentavos"
    FROM "Servico" AS s
    WHERE s."id" = NEW."servicoId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Agendamento_preco_do_atendimento"
BEFORE INSERT OR UPDATE OF "servicoId", "precoCentavos" ON "Agendamento"
FOR EACH ROW EXECUTE FUNCTION "preco_do_atendimento"();
