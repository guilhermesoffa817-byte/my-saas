-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "semLembretes" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "lembreteAntes" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lembreteNoDia" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lembreteSeteDias" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lembreteTresDias" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "pixChave" TEXT,
ADD COLUMN     "pixCidade" TEXT;

-- CreateTable
CREATE TABLE "Cobranca" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "agendamentoId" TEXT,
    "valorCentavos" INTEGER NOT NULL,
    "vencimento" DATE NOT NULL,
    "situacao" TEXT NOT NULL DEFAULT 'aberta',
    "formaDePagamento" TEXT,
    "pagaEm" DATE,
    "lancamentoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cobranca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LembreteDeCobranca" (
    "id" TEXT NOT NULL,
    "cobrancaId" TEXT NOT NULL,
    "momento" TEXT NOT NULL,
    "enviadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LembreteDeCobranca_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Cobranca_usuarioId_situacao_vencimento_idx" ON "Cobranca"("usuarioId", "situacao", "vencimento");

-- CreateIndex
CREATE INDEX "Cobranca_clienteId_idx" ON "Cobranca"("clienteId");

-- CreateIndex
CREATE INDEX "Cobranca_agendamentoId_idx" ON "Cobranca"("agendamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "LembreteDeCobranca_cobrancaId_momento_key" ON "LembreteDeCobranca"("cobrancaId", "momento");

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cobranca" ADD CONSTRAINT "Cobranca_agendamentoId_fkey" FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LembreteDeCobranca" ADD CONSTRAINT "LembreteDeCobranca_cobrancaId_fkey" FOREIGN KEY ("cobrancaId") REFERENCES "Cobranca"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Um horário não pode ter duas cobranças vivas ao mesmo tempo.
-- O índice é parcial de propósito: cobrança cancelada sai da conta, então
-- quem cancelar por engano consegue cobrar de novo. É esta linha que impede
-- o toque duplo em "Cobrar" de criar duas cobranças, mesmo que dois pedidos
-- cheguem ao servidor no mesmo instante.
CREATE UNIQUE INDEX "Cobranca_agendamento_viva"
  ON "Cobranca" ("agendamentoId")
  WHERE "agendamentoId" IS NOT NULL AND "situacao" <> 'cancelada';

-- Segurança por linha.
--
-- No Supabase existe um gatilho que liga o RLS em toda tabela nova, mas o
-- banco local não tem esse gatilho, e uma tabela sem RLS fica aberta pela API
-- pública do Supabase. Ligar aqui também deixa os dois iguais e não depende de
-- o gatilho continuar existindo.
ALTER TABLE "Cobranca" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LembreteDeCobranca" ENABLE ROW LEVEL SECURITY;

-- Permissão e política para o papel da aplicação, no mesmo molde das tabelas
-- que já existem. Nenhuma política para anon nem para authenticated: é
-- justamente a ausência delas que fecha a porta da API pública.
-- O bloco confere se o papel existe, porque no banco local ele não existe.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agenda_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Cobranca" TO agenda_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "LembreteDeCobranca" TO agenda_app;

    CREATE POLICY agenda_app_full ON "Cobranca"
      FOR ALL TO agenda_app USING (true) WITH CHECK (true);
    CREATE POLICY agenda_app_full ON "LembreteDeCobranca"
      FOR ALL TO agenda_app USING (true) WITH CHECK (true);
  END IF;
END
$$;
