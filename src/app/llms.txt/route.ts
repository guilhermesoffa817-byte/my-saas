import { textoParaIas } from "@/lib/texto-para-ias";

// Montado na publicação, com as chaves do servidor: muda quando o site é publicado de novo.
export const dynamic = "force-static";

export function GET() {
  return new Response(textoParaIas(), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
