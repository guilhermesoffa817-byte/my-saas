-- CreateTable
CREATE TABLE "TentativaDeEntrada" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativaDeEntrada_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TentativaDeEntrada_emailHash_criadoEm_idx" ON "TentativaDeEntrada"("emailHash", "criadoEm");

-- CreateIndex
CREATE INDEX "TentativaDeEntrada_ipHash_criadoEm_idx" ON "TentativaDeEntrada"("ipHash", "criadoEm");

-- CreateIndex
CREATE INDEX "TentativaDeEntrada_criadoEm_idx" ON "TentativaDeEntrada"("criadoEm");

-- Segurança por linha, como em PedidoDeSenha: a tabela diz quais e-mails
-- andam errando a senha, então fica fora da API pública do banco.
ALTER TABLE "TentativaDeEntrada" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agenda_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "TentativaDeEntrada" TO agenda_app;
    CREATE POLICY agenda_app_full ON "TentativaDeEntrada"
      FOR ALL TO agenda_app USING (true) WITH CHECK (true);
  END IF;
END
$$;
