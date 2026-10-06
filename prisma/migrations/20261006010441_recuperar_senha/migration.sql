-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "sessaoVersao" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PedidoDeSenha" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "codigoHash" TEXT,
    "entregueEm" TIMESTAMP(3),
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "usadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PedidoDeSenha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PedidoDeSenha_codigoHash_key" ON "PedidoDeSenha"("codigoHash");

-- CreateIndex
CREATE INDEX "PedidoDeSenha_usuarioId_usadoEm_idx" ON "PedidoDeSenha"("usuarioId", "usadoEm");

-- AddForeignKey
ALTER TABLE "PedidoDeSenha" ADD CONSTRAINT "PedidoDeSenha_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Segurança por linha, igual às demais tabelas novas. Esta guarda o resumo de
-- códigos que abrem contas: é a que mais precisa ficar fora da API pública.
ALTER TABLE "PedidoDeSenha" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agenda_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "PedidoDeSenha" TO agenda_app;
    CREATE POLICY agenda_app_full ON "PedidoDeSenha"
      FOR ALL TO agenda_app USING (true) WITH CHECK (true);
  END IF;
END
$$;
