-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN     "origem" TEXT,
ADD COLUMN     "vistoEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Servico" ADD COLUMN     "agendavelOnline" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "AgendaOnline" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT false,
    "antecedenciaMin" INTEGER NOT NULL DEFAULT 120,
    "diasAFrente" INTEGER NOT NULL DEFAULT 30,
    "escolherQuemAtende" BOOLEAN NOT NULL DEFAULT false,
    "donaAtende" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgendaOnline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaixaDeAtendimento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "diaDaSemana" INTEGER NOT NULL,
    "inicioMin" INTEGER NOT NULL,
    "fimMin" INTEGER NOT NULL,

    CONSTRAINT "FaixaDeAtendimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TentativaDeAgendamento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "telefoneHash" TEXT,
    "sucesso" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativaDeAgendamento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgendaOnline_usuarioId_key" ON "AgendaOnline"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "AgendaOnline_link_key" ON "AgendaOnline"("link");

-- CreateIndex
CREATE INDEX "FaixaDeAtendimento_usuarioId_diaDaSemana_idx" ON "FaixaDeAtendimento"("usuarioId", "diaDaSemana");

-- CreateIndex
CREATE INDEX "TentativaDeAgendamento_ipHash_criadoEm_idx" ON "TentativaDeAgendamento"("ipHash", "criadoEm");

-- CreateIndex
CREATE INDEX "TentativaDeAgendamento_telefoneHash_criadoEm_idx" ON "TentativaDeAgendamento"("telefoneHash", "criadoEm");

-- CreateIndex
CREATE INDEX "TentativaDeAgendamento_criadoEm_idx" ON "TentativaDeAgendamento"("criadoEm");

-- AddForeignKey
ALTER TABLE "AgendaOnline" ADD CONSTRAINT "AgendaOnline_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaixaDeAtendimento" ADD CONSTRAINT "FaixaDeAtendimento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TentativaDeAgendamento" ADD CONSTRAINT "TentativaDeAgendamento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
