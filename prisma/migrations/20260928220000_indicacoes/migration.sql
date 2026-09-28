-- Link de indicação: quem indica ganha um código, e quem chega por ele fica marcado.
ALTER TABLE "Usuario" ADD COLUMN "codigoIndicacao" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "indicadoPor" TEXT;

CREATE UNIQUE INDEX "Usuario_codigoIndicacao_key" ON "Usuario"("codigoIndicacao");
CREATE INDEX "Usuario_indicadoPor_idx" ON "Usuario"("indicadoPor");
