import Link from "next/link";
import { exigirPainel } from "@/lib/guardas";
import { recursosLigados, recursosLiberados } from "@/lib/recursos";
import { sair, sairDaVisita } from "@/app/acoes/autenticacao";
import { Cartao, TituloDaTela } from "@/componentes/ui/cartao";
import { BotaoEnviar } from "@/componentes/ui/botao";
import { Icone } from "@/componentes/ui/icones";
import { SECUNDARIOS, destinosVisiveis } from "../itens";

export const metadata = { title: "Mais" };
export const dynamic = "force-dynamic";

/**
 * O que não coube na barra de baixo. Existe só no celular, mas a rota responde
 * no computador também, para que um link compartilhado nunca caia em nada.
 */
export default async function PaginaMais() {
  const { usuario, situacao, visitante } = await exigirPainel();
  // Na demonstração o estúdio de exemplo tem tudo: todas as abas aparecem.
  const destinos = destinosVisiveis(SECUNDARIOS, {
    liberados: situacao.demonstracao ? recursosLigados() : recursosLiberados(usuario),
    admin: usuario.papel === "admin",
  });

  return (
    <div className="space-y-6">
      {/* Na demonstração os dados são do estúdio de exemplo, não do negócio da conta. */}
      <TituloDaTela explicacao={situacao.demonstracao ? "Estúdio de exemplo" : usuario.nomeNegocio}>
        Mais
      </TituloDaTela>

      <ul className="space-y-3">
        {destinos.map((item) => (
          <li key={item.href}>
            <Link href={item.href} className="block">
              <Cartao className="transition hover:border-terracota/50">
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-areia text-terracota">
                    <Icone nome={item.icone} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-display font-semibold text-carvao">{item.rotulo}</p>
                    <p className="text-sm leading-relaxed text-carvao-suave">
                      {item.explicacao}
                    </p>
                  </div>
                </div>
              </Cartao>
            </Link>
          </li>
        ))}
      </ul>

      {visitante ? (
        /* Quem olha o exemplo sem conta: o próximo passo é criar a conta. */
        <div className="space-y-3">
          <Link href="/criar-conta" className="botao w-full">
            Gostei, quero criar minha conta
          </Link>
          <form action={sairDaVisita}>
            <BotaoEnviar variante="suave" className="w-full">
              Sair do exemplo
            </BotaoEnviar>
          </form>
        </div>
      ) : (
        <form action={sair}>
          <BotaoEnviar variante="suave" className="w-full">
            Sair da minha conta
          </BotaoEnviar>
        </form>
      )}
    </div>
  );
}
