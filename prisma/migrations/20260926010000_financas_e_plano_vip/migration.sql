-- Plano vigente da assinatura: é ele que libera a aba Finanças.
ALTER TABLE "Assinatura" ADD COLUMN "plano" TEXT NOT NULL DEFAULT 'mensal';

-- Percentual para estimar o imposto do mês.
ALTER TABLE "Usuario" ADD COLUMN "impostoPercentual" INTEGER NOT NULL DEFAULT 6;

-- Dinheiro que entra ou sai fora dos atendimentos.
CREATE TABLE "Lancamento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT,
    "valorCentavos" INTEGER NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Lancamento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Lancamento_usuarioId_data_idx" ON "Lancamento"("usuarioId", "data");

ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_usuarioId_fkey"
  FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Lancamento" ENABLE ROW LEVEL SECURITY;
