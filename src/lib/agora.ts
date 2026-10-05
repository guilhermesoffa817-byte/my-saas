import "server-only";

import { cache } from "react";

/**
 * O instante do pedido, igual para a página inteira.
 *
 * Ler o relógio no meio da montagem da tela dá resultados que mudam entre uma
 * parte e outra da mesma página: dois trechos podem discordar sobre que horas
 * são. O `cache` do React guarda a primeira leitura durante o pedido, então
 * tudo na mesma tela enxerga o mesmo instante.
 */
export const agoraDoPedido = cache(() => new Date());
