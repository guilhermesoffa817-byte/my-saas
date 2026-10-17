-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "iaAceitaEm" TIMESTAMP(3),
ADD COLUMN     "ramo" TEXT;

-- CreateTable
CREATE TABLE "ConversaDeIa" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "sistema" TEXT NOT NULL,
    "ferramentas" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversaDeIa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MensagemDeIa" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "papel" TEXT NOT NULL,
    "conteudo" TEXT NOT NULL,
    "textoNaTela" TEXT,
    "motivoParada" TEXT,
    "situacao" TEXT,
    "usoDeIaId" TEXT,
    "chamadas" INTEGER NOT NULL DEFAULT 0,
    "descartada" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MensagemDeIa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConversaDeIa_usuarioId_atualizadoEm_idx" ON "ConversaDeIa"("usuarioId", "atualizadoEm");

-- CreateIndex
CREATE INDEX "MensagemDeIa_usuarioId_idx" ON "MensagemDeIa"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "MensagemDeIa_conversaId_ordem_key" ON "MensagemDeIa"("conversaId", "ordem");

-- AddForeignKey
ALTER TABLE "ConversaDeIa" ADD CONSTRAINT "ConversaDeIa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemDeIa" ADD CONSTRAINT "MensagemDeIa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MensagemDeIa" ADD CONSTRAINT "MensagemDeIa_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "ConversaDeIa"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Regras que o banco confere sozinho. O Prisma não escreve CHECK no schema, mas
-- também não mexe neles: ficam aqui, escritos à mão.
ALTER TABLE "MensagemDeIa" ADD CONSTRAINT "MensagemDeIa_papel_check"
  CHECK ("papel" IN ('user', 'assistant'));
ALTER TABLE "MensagemDeIa" ADD CONSTRAINT "MensagemDeIa_situacao_check"
  CHECK ("situacao" IS NULL OR "situacao" IN
    ('andamento', 'concluida', 'recusada', 'cortada', 'voltas', 'interrompida', 'erro'));
-- Situação, reserva e contagem de chamadas só existem na pergunta (papel user).
ALTER TABLE "MensagemDeIa" ADD CONSTRAINT "MensagemDeIa_situacao_da_pergunta_check"
  CHECK ("situacao" IS NULL OR "papel" = 'user');
ALTER TABLE "MensagemDeIa" ADD CONSTRAINT "MensagemDeIa_ordem_check"
  CHECK ("ordem" >= 0 AND "chamadas" >= 0);
