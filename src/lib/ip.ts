/**
 * O IP de quem fez o pedido, do jeito que a hospedagem entrega. Na Netlify o
 * cabeçalho próprio vem primeiro, porque o x-forwarded-for pode ser escrito
 * pelo próprio visitante.
 */
export function ipDoPedido(cabecalhos: Headers) {
  return (
    cabecalhos.get("x-nf-client-connection-ip") ??
    cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    cabecalhos.get("x-real-ip") ??
    "desconhecido"
  );
}
