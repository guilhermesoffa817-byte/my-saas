-- O percentual do imposto estimado passa a aceitar casas decimais (4,5%).
--
-- A coluna era inteira e a tela arredondava sem avisar: 4,5 virava 5, e a
-- estimativa do mês saía errada. As alíquotas efetivas do Simples Nacional
-- quase sempre têm casas decimais. Os valores de hoje (6, 8...) continuam os
-- mesmos; o imposto em reais segue calculado em centavos inteiros.
ALTER TABLE "Usuario" ALTER COLUMN "impostoPercentual" SET DATA TYPE DOUBLE PRECISION;
