-- CreateTable
CREATE TABLE "FechamentoDoMes" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "fechado" BOOLEAN NOT NULL DEFAULT true,
    "resumo" JSONB NOT NULL,
    "fechadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reabertoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FechamentoDoMes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistroDeFechamento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "acao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroDeFechamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcessoDoContador" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revogadoEm" TIMESTAMP(3),
    "ultimoAcessoEm" TIMESTAMP(3),

    CONSTRAINT "AcessoDoContador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TentativaDoContador" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativaDoContador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FechamentoDoMes_usuarioId_competencia_key" ON "FechamentoDoMes"("usuarioId", "competencia");

-- CreateIndex
CREATE INDEX "RegistroDeFechamento_usuarioId_competencia_criadoEm_idx" ON "RegistroDeFechamento"("usuarioId", "competencia", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "AcessoDoContador_codigoHash_key" ON "AcessoDoContador"("codigoHash");

-- CreateIndex
CREATE INDEX "AcessoDoContador_usuarioId_revogadoEm_idx" ON "AcessoDoContador"("usuarioId", "revogadoEm");

-- CreateIndex
CREATE INDEX "TentativaDoContador_ipHash_criadoEm_idx" ON "TentativaDoContador"("ipHash", "criadoEm");

-- CreateIndex
CREATE INDEX "TentativaDoContador_criadoEm_idx" ON "TentativaDoContador"("criadoEm");

-- AddForeignKey
ALTER TABLE "FechamentoDoMes" ADD CONSTRAINT "FechamentoDoMes_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistroDeFechamento" ADD CONSTRAINT "RegistroDeFechamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcessoDoContador" ADD CONSTRAINT "AcessoDoContador_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
