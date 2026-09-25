-- CPF e endereço da cliente, os dois opcionais: muita gente cadastra
-- na correria e só completa depois.
ALTER TABLE "Cliente" ADD COLUMN "cpf" TEXT;
ALTER TABLE "Cliente" ADD COLUMN "endereco" TEXT;
