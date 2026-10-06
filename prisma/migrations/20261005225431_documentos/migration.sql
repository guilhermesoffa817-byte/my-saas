-- CreateTable
CREATE TABLE "Documento" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "caminho" TEXT NOT NULL,
    "tipoDoArquivo" TEXT NOT NULL,
    "tamanhoBytes" INTEGER NOT NULL,
    "paginas" INTEGER,
    "situacao" TEXT NOT NULL DEFAULT 'lendo',
    "motivoDaFalha" TEXT,
    "tipoDeDocumento" TEXT,
    "partes" TEXT,
    "resumo" TEXT,
    "fimDoContrato" DATE,
    "reajusteEm" DATE,
    "indiceDeReajuste" TEXT,
    "multa" TEXT,
    "avisoPrevio" TEXT,
    "leituraEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemDoDocumento" (
    "id" TEXT NOT NULL,
    "documentoId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'saida',
    "valorCentavos" INTEGER,
    "data" DATE,
    "repeticao" TEXT,
    "repeteAte" DATE,
    "trecho" TEXT,
    "pagina" INTEGER,
    "duvidoso" BOOLEAN NOT NULL DEFAULT false,
    "decisao" TEXT,
    "vencimentoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemDoDocumento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Documento_usuarioId_situacao_criadoEm_idx" ON "Documento"("usuarioId", "situacao", "criadoEm");

-- CreateIndex
CREATE INDEX "ItemDoDocumento_documentoId_idx" ON "ItemDoDocumento"("documentoId");

-- AddForeignKey
ALTER TABLE "Documento" ADD CONSTRAINT "Documento_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ItemDoDocumento" ADD CONSTRAINT "ItemDoDocumento_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "Documento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Segurança por linha, igual às tabelas anteriores. Documento tem CPF, endereço
-- e valores de contrato: é a tabela que mais precisa disso.
ALTER TABLE "Documento" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemDoDocumento" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agenda_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "Documento" TO agenda_app;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "ItemDoDocumento" TO agenda_app;

    CREATE POLICY agenda_app_full ON "Documento"
      FOR ALL TO agenda_app USING (true) WITH CHECK (true);
    CREATE POLICY agenda_app_full ON "ItemDoDocumento"
      FOR ALL TO agenda_app USING (true) WITH CHECK (true);
  END IF;
END
$$;
