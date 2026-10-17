-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN     "colaboradorId" TEXT;

-- CreateTable
CREATE TABLE "Colaborador" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT,
    "vinculo" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE,
    "salarioCentavos" INTEGER NOT NULL DEFAULT 0,
    "comissaoPontosBase" INTEGER NOT NULL DEFAULT 0,
    "porAtendimentoCentavos" INTEGER NOT NULL DEFAULT 0,
    "documento" TEXT,
    "pixChave" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "observacoes" TEXT,
    "anonimizadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AusenciaDoColaborador" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "inicio" DATE NOT NULL,
    "fim" DATE NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AusenciaDoColaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PagamentoDeColaborador" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "colaboradorId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "competencia" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "pagoEm" DATE NOT NULL,
    "lancamentoId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PagamentoDeColaborador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Colaborador_usuarioId_idx" ON "Colaborador"("usuarioId");

-- CreateIndex
CREATE INDEX "AusenciaDoColaborador_usuarioId_inicio_idx" ON "AusenciaDoColaborador"("usuarioId", "inicio");

-- CreateIndex
CREATE INDEX "AusenciaDoColaborador_colaboradorId_idx" ON "AusenciaDoColaborador"("colaboradorId");

-- CreateIndex
CREATE UNIQUE INDEX "PagamentoDeColaborador_lancamentoId_key" ON "PagamentoDeColaborador"("lancamentoId");

-- CreateIndex
CREATE INDEX "PagamentoDeColaborador_usuarioId_competencia_idx" ON "PagamentoDeColaborador"("usuarioId", "competencia");

-- CreateIndex
CREATE INDEX "PagamentoDeColaborador_colaboradorId_idx" ON "PagamentoDeColaborador"("colaboradorId");

-- CreateIndex
CREATE INDEX "Agendamento_colaboradorId_inicio_idx" ON "Agendamento"("colaboradorId", "inicio");

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Colaborador" ADD CONSTRAINT "Colaborador_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AusenciaDoColaborador" ADD CONSTRAINT "AusenciaDoColaborador_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AusenciaDoColaborador" ADD CONSTRAINT "AusenciaDoColaborador_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoDeColaborador" ADD CONSTRAINT "PagamentoDeColaborador_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoDeColaborador" ADD CONSTRAINT "PagamentoDeColaborador_colaboradorId_fkey" FOREIGN KEY ("colaboradorId") REFERENCES "Colaborador"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PagamentoDeColaborador" ADD CONSTRAINT "PagamentoDeColaborador_lancamentoId_fkey" FOREIGN KEY ("lancamentoId") REFERENCES "Lancamento"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- Regras que o banco confere sozinho, além das da tela. O Prisma não descreve
-- CHECK no schema, mas também não os apaga: ficam aqui, escritos à mão.
-- São só tabelas novas, então nada que já existe em produção é afetado.
ALTER TABLE "Colaborador" ADD CONSTRAINT "Colaborador_vinculo_check"
  CHECK ("vinculo" IN ('clt', 'parceria', 'mei', 'pj', 'autonomo', 'estagio'));
ALTER TABLE "Colaborador" ADD CONSTRAINT "Colaborador_valores_check"
  CHECK ("salarioCentavos" >= 0 AND "porAtendimentoCentavos" >= 0
         AND "comissaoPontosBase" BETWEEN 0 AND 10000);
ALTER TABLE "Colaborador" ADD CONSTRAINT "Colaborador_periodo_check"
  CHECK ("fim" IS NULL OR "fim" >= "inicio");

ALTER TABLE "AusenciaDoColaborador" ADD CONSTRAINT "AusenciaDoColaborador_tipo_check"
  CHECK ("tipo" IN ('ferias', 'recesso', 'folga', 'atestado', 'licenca', 'falta', 'indisponivel'));
ALTER TABLE "AusenciaDoColaborador" ADD CONSTRAINT "AusenciaDoColaborador_periodo_check"
  CHECK ("fim" >= "inicio");

ALTER TABLE "PagamentoDeColaborador" ADD CONSTRAINT "PagamentoDeColaborador_tipo_check"
  CHECK ("tipo" IN ('salario', 'comissao', 'cota_parte', 'repasse', 'bolsa', 'adiantamento',
                    'bonus', 'beneficio', 'encargo', 'rescisao', 'outro'));
ALTER TABLE "PagamentoDeColaborador" ADD CONSTRAINT "PagamentoDeColaborador_valor_check"
  CHECK ("valorCentavos" > 0);
ALTER TABLE "PagamentoDeColaborador" ADD CONSTRAINT "PagamentoDeColaborador_competencia_check"
  CHECK ("competencia" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
