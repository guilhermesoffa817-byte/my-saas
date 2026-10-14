-- Preço combinado em cada atendimento. Os horários antigos recebem o preço que
-- o serviço tem hoje, que é o mesmo número que o faturamento já mostrava.
ALTER TABLE "Agendamento" ADD COLUMN "valorCentavos" INTEGER;
ALTER TABLE "Agendamento" ADD COLUMN "confirmacaoEnviadaEm" TIMESTAMP(3);

UPDATE "Agendamento" AS a
SET "valorCentavos" = s."precoCentavos"
FROM "Servico" AS s
WHERE s."id" = a."servicoId" AND a."valorCentavos" IS NULL;

-- Cliente com histórico passa a ser arquivada em vez de apagada.
ALTER TABLE "Cliente" ADD COLUMN "arquivadoEm" TIMESTAMP(3);

-- Senhas erradas na entrada, para frear quem tenta adivinhar.
CREATE TABLE "TentativaDeEntrada" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativaDeEntrada_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TentativaDeEntrada_chave_criadoEm_idx" ON "TentativaDeEntrada"("chave", "criadoEm");

/*
  No banco de produção o site conversa com o banco por um usuário próprio,
  "agenda_app", e toda tabela nova nasce com RLS ligado. Esse usuário precisa de
  permissão e de política em cada tabela. A de lançamentos tinha ficado sem as
  duas, o que travava Finanças e o "marcar como pago". Num banco sem esse
  usuário (como o de desenvolvimento), este bloco não faz nada.
*/
DO $$
DECLARE
  tabela TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agenda_app') THEN
    FOREACH tabela IN ARRAY ARRAY['Lancamento', 'TentativaDeEntrada'] LOOP
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO agenda_app', tabela);
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tabela AND policyname = 'agenda_app_full'
      ) THEN
        EXECUTE format(
          'CREATE POLICY agenda_app_full ON public.%I FOR ALL TO agenda_app USING (true) WITH CHECK (true)',
          tabela
        );
      END IF;
    END LOOP;
  END IF;
END $$;
