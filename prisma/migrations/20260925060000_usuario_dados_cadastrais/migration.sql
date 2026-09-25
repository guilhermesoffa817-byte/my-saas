-- Dados de cadastro de quem assina. Ficam opcionais no banco por causa das
-- contas que já existiam; o formulário é que passa a exigir os obrigatórios.
ALTER TABLE "Usuario" ADD COLUMN "documento" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "cep" TEXT;
ALTER TABLE "Usuario" ADD COLUMN "endereco" TEXT;
