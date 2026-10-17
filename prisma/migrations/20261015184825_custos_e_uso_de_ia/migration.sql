-- AlterTable
ALTER TABLE "Lancamento" ADD COLUMN     "natureza" TEXT,
ADD COLUMN     "naturezaMotivo" VARCHAR(200),
ADD COLUMN     "naturezaOrigem" TEXT;

-- CreateTable
CREATE TABLE "UsoDeIa" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "recurso" TEXT NOT NULL,
    "unidades" INTEGER NOT NULL DEFAULT 1,
    "tokensEntrada" INTEGER NOT NULL DEFAULT 0,
    "tokensSaida" INTEGER NOT NULL DEFAULT 0,
    "tokensCacheLeitura" INTEGER NOT NULL DEFAULT 0,
    "tokensCacheEscrita" INTEGER NOT NULL DEFAULT 0,
    "buscasNaWeb" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsoDeIa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsoDeIa_usuarioId_recurso_criadoEm_idx" ON "UsoDeIa"("usuarioId", "recurso", "criadoEm");

-- AddForeignKey
ALTER TABLE "UsoDeIa" ADD CONSTRAINT "UsoDeIa_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Regras que o banco confere sozinho. O Prisma não escreve CHECK no schema, mas
-- também não os apaga: ficam aqui, escritos à mão. Todas aceitam vazio, então
-- os lançamentos que já existem continuam válidos sem mudar nada.
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_natureza_check"
  CHECK ("natureza" IS NULL OR "natureza" IN ('fixo', 'variavel', 'nao_operacional'));
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_naturezaOrigem_check"
  CHECK ("naturezaOrigem" IS NULL OR "naturezaOrigem" IN ('regra', 'ia', 'voce'));
-- Natureza é coisa de saída, e não existe origem sem natureza.
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_natureza_so_em_saida_check"
  CHECK ("natureza" IS NULL OR "tipo" = 'saida');
ALTER TABLE "Lancamento" ADD CONSTRAINT "Lancamento_natureza_com_origem_check"
  CHECK (("natureza" IS NULL) = ("naturezaOrigem" IS NULL));

ALTER TABLE "UsoDeIa" ADD CONSTRAINT "UsoDeIa_recurso_check"
  CHECK ("recurso" IN ('classificacao', 'assistente', 'leitura'));
ALTER TABLE "UsoDeIa" ADD CONSTRAINT "UsoDeIa_numeros_check"
  CHECK ("unidades" > 0 AND "tokensEntrada" >= 0 AND "tokensSaida" >= 0
    AND "tokensCacheLeitura" >= 0 AND "tokensCacheEscrita" >= 0 AND "buscasNaWeb" >= 0);

-- Os pagamentos da Equipe que já existem ganham a natureza que teriam ao nascer
-- hoje: comissão, cota-parte e repasse acompanham os atendimentos; salário e
-- bolsa se pagam todo mês. Só preenche o que está vazio.
UPDATE "Lancamento" AS l
SET "natureza" = 'variavel',
    "naturezaOrigem" = 'regra',
    "naturezaMotivo" = 'Pagamento da Equipe que acompanha os atendimentos.'
FROM "PagamentoDeColaborador" AS p
WHERE p."lancamentoId" = l."id"
  AND l."natureza" IS NULL
  AND l."tipo" = 'saida'
  AND p."tipo" IN ('comissao', 'cota_parte', 'repasse');

UPDATE "Lancamento" AS l
SET "natureza" = 'fixo',
    "naturezaOrigem" = 'regra',
    "naturezaMotivo" = 'Pagamento da Equipe que se repete todo mês.'
FROM "PagamentoDeColaborador" AS p
WHERE p."lancamentoId" = l."id"
  AND l."natureza" IS NULL
  AND l."tipo" = 'saida'
  AND p."tipo" IN ('salario', 'bolsa');
