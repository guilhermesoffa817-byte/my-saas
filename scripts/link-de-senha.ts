/**
 * Link de senha nova pelo terminal:  npm run senha:link -- voce@email.com.br
 *
 * Existe para a administração. Quem esquece a senha pede na tela de entrada e
 * a administração gera o link no painel; mas, se quem esqueceu foi a própria
 * administração, não há painel aberto para atender o pedido. Este comando faz
 * o mesmo que o botão "Gerar link de senha", direto no banco do DATABASE_URL.
 *
 * Use com o .env apontando para o banco certo. O link vale meia hora e uma
 * vez só, e gerá-lo derruba qualquer link anterior da mesma conta.
 */
import { PrismaClient } from "../src/generated/prisma";
import { criarLinkDeSenha } from "../src/lib/pedidos-de-senha";
import { linkDaNovaSenha, MINUTOS_DE_VALIDADE } from "../src/lib/senha";
import { ehContaDeExemplo } from "../src/lib/demonstracao/conta";
import { ENDERECO_DO_SITE } from "../src/lib/site";

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!email) {
    console.error("Diga de qual conta: npm run senha:link -- voce@email.com.br");
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient();
  try {
    const usuario = await prisma.usuario.findUnique({
      where: { email },
      select: { id: true, papel: true, nome: true },
    });
    if (!usuario || ehContaDeExemplo(usuario)) {
      console.error(`Não existe conta com o e-mail ${email} neste banco.`);
      process.exitCode = 1;
      return;
    }

    const codigo = await criarLinkDeSenha(prisma, usuario.id, new Date());
    console.log(`Link de senha nova para ${usuario.nome} (${email}):`);
    console.log(linkDaNovaSenha(ENDERECO_DO_SITE, codigo));
    console.log(`Vale por ${MINUTOS_DE_VALIDADE} minutos e só funciona uma vez.`);
  } finally {
    await prisma.$disconnect();
  }
}

void main();
