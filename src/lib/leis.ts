/**
 * Números que vêm de lei, num lugar só, cada um com a fonte e a data em que
 * foi conferido. Quando a lei mudar, muda aqui e o resto do Bossa acompanha.
 *
 * Nenhum deles decide nada sozinho: servem para o Bossa apontar o que vale
 * conferir com o contador.
 */

/**
 * MEI com empregado: no máximo um, recebendo o salário mínimo ou o piso da
 * categoria. Fonte: Lei Complementar 123/2006, art. 18-C (planalto.gov.br),
 * conferido em outubro de 2026.
 */
export const MEI_MAX_EMPREGADOS = 1;

/**
 * Estágio na mesma empresa dura no máximo dois anos, salvo estagiário com
 * deficiência. Fonte: Lei 11.788/2008, art. 11 (planalto.gov.br), conferido em
 * outubro de 2026.
 */
export const ESTAGIO_DURACAO_MAX_MESES = 24;
