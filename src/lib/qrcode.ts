import "server-only";
import QRCode from "qrcode";

/**
 * O QR Code do Pix só muda quando a chave ou o valor mudam — ou seja, quase
 * nunca. Desenhar de novo a cada visita era trabalho jogado fora, então o
 * resultado fica guardado enquanto o servidor estiver de pé.
 */
const desenhados = new Map<string, string>();

export async function qrCodeSvg(conteudo: string) {
  const guardado = desenhados.get(conteudo);
  if (guardado) return guardado;

  const svg = await QRCode.toString(conteudo, {
    type: "svg",
    margin: 1,
    color: { dark: "#2f2722", light: "#ffffff" },
  });

  desenhados.set(conteudo, svg);
  return svg;
}
