import "server-only";

import { headers } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { abrirPeloCodigo } from "@/lib/contador/operacoes";
import { embaralhar } from "@/lib/agendamento-online/embaralhar";
import { ipDoPedido } from "@/lib/ip";

/**
 * Confere o código uma vez por pedido. O IP vai embaralhado com o segredo do
 * servidor: a tabela de tentativas nunca guarda o IP em texto.
 */
export const abrirComCodigo = cache(async (codigo: string) => {
  const ipHash = embaralhar("ip", `contador:${ipDoPedido(await headers())}`);
  return abrirPeloCodigo(prisma, codigo, ipHash, new Date());
});
