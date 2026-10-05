-- CreateTable
CREATE TABLE "Vencimento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'conta',
    "descricao" TEXT NOT NULL,
    "categoria" TEXT,
    "valorCentavos" INTEGER,
    "data" DATE NOT NULL,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "pagoEm" DATE,
    "lancamentoId" TEXT,
    "repeticaoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vencimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepeticaoDeVencimento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'conta',
    "descricao" TEXT NOT NULL,
    "categoria" TEXT,
    "valorCentavos" INTEGER,
    "primeira" DATE NOT NULL,
    "ate" DATE,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepeticaoDeVencimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Vencimento_usuarioId_pago_data_idx" ON "Vencimento"("usuarioId", "pago", "data");

-- CreateIndex
CREATE UNIQUE INDEX "Vencimento_repeticaoId_data_key" ON "Vencimento"("repeticaoId", "data");

-- CreateIndex
CREATE INDEX "RepeticaoDeVencimento_usuarioId_ativa_idx" ON "RepeticaoDeVencimento"("usuarioId", "ativa");

-- AddForeignKey
ALTER TABLE "Vencimento" ADD CONSTRAINT "Vencimento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vencimento" ADD CONSTRAINT "Vencimento_repeticaoId_fkey" FOREIGN KEY ("repeticaoId") REFERENCES "RepeticaoDeVencimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepeticaoDeVencimento" ADD CONSTRAINT "RepeticaoDeVencimento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Segurança por linha, igual às tabelas de cobrança: o gatilho do Supabase
-- faria isso sozinho, mas o banco local não tem o gatilho, e tabela sem RLS
-- fica aberta pela API pública. Nenhuma política para anon nem authenticated.
ALTER TABLE "Vencimento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RepeticaoDeVencimento" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agenda_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Vencimento" TO agenda_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "RepeticaoDeVencimento" TO agenda_app;

    CREATE POLICY agenda_app_full ON "Vencimento"
      FOR ALL TO agenda_app USING (true) WITH CHECK (true);
    CREATE POLICY agenda_app_full ON "RepeticaoDeVencimento"
      FOR ALL TO agenda_app USING (true) WITH CHECK (true);
  END IF;
END
$$;
