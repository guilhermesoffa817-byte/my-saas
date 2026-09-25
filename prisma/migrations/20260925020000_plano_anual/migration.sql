-- Guarda qual plano foi pago, para o painel saber quantos dias liberar.
ALTER TABLE "Pagamento" ADD COLUMN "plano" TEXT NOT NULL DEFAULT 'mensal';

-- Valor padrão acompanha o preço vigente (R$ 169,00).
ALTER TABLE "Pagamento" ALTER COLUMN "valorCentavos" SET DEFAULT 16900;
