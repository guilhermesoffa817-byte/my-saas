import { prisma } from "@/lib/prisma";
import { exigirLeituraDoRecurso } from "@/lib/guardas";
import { limiteDeIa } from "@/lib/recursos";
import { Cartao, TituloDaTela } from "@/componentes/ui/cartao";
import { idValido, perguntaDoLink, type MensagemDaTela } from "@/lib/assistente/protocolo";
import { mensagensParaTela } from "@/lib/ia/assistente";
import { iaConfigurada } from "@/lib/ia/cliente";
import {
  apagarConversasParadas,
  conversaDoUsuario,
  linhasDaConversa,
  listarConversas,
} from "@/lib/ia/conversas";
import { cotaDeIa } from "@/lib/ia/franquia";
import { cidadeDoEstudio } from "@/lib/ia/sistema";
import { AvisoDeConsentimento, FormularioDoRamo } from "./aviso";
import { ChatDoAssistente } from "./chat";

export const metadata = { title: "Assistente" };
export const dynamic = "force-dynamic";

function Cabecalho() {
  return (
    <TituloDaTela explicacao="Pergunte sobre o seu negócio. O assistente lê os números do Bossa e responde com sugestões, mostrando de onde tirou cada um.">
      Assistente
    </TituloDaTela>
  );
}

export default async function PaginaAssistente({
  searchParams,
}: {
  /** `c`: a conversa aberta. `pergunta`: só preenche o campo, nunca envia sozinha. */
  searchParams: Promise<{ c?: string | string[]; pergunta?: string | string[] }>;
}) {
  const { usuario, demonstracao } = await exigirLeituraDoRecurso("assistente");

  // Na demonstração a conversa de exemplo aparece mesmo sem a IA configurada:
  // perguntar leva para a assinatura antes de chegar à IA.
  if (!demonstracao && !iaConfigurada()) {
    return (
      <div className="space-y-6">
        <Cabecalho />
        <Cartao className="max-w-2xl space-y-2">
          <h2 className="font-display text-lg font-semibold text-carvao">O assistente ainda não foi ativado</h2>
          <p className="text-sm leading-relaxed text-carvao-suave">
            Falta configurar a chave de acesso à inteligência artificial no servidor do Bossa. Enquanto isso, o
            resto do sistema funciona normalmente, e as suas finanças e custos continuam nas telas de sempre.
          </p>
        </Cartao>
      </div>
    );
  }

  // Retenção: conversa parada há 90 dias sai quando a tela abre, sem tarefa
  // agendada. Nunca no estúdio de exemplo, que é só de leitura.
  if (!demonstracao) await apagarConversasParadas(prisma, usuario.id).catch(() => 0);

  if (!usuario.iaAceitaEm) {
    return (
      <div className="space-y-6">
        <Cabecalho />
        <AvisoDeConsentimento />
      </div>
    );
  }

  const { c, pergunta } = await searchParams;
  const conversas = await listarConversas(prisma, usuario.id);
  // Na demonstração a tela já abre numa conversa de exemplo, com a resposta pronta.
  const pedida = idValido(c) ? c : demonstracao && !pergunta ? (conversas[0]?.id ?? null) : null;

  const [cota, conversa] = await Promise.all([
    cotaDeIa(prisma, usuario.id, "assistente", limiteDeIa(usuario, "assistente"))
      .then((v) => ({ usados: v.usados, limite: v.limite }))
      .catch(() => null),
    pedida ? conversaDoUsuario(prisma, usuario.id, pedida) : Promise.resolve(null),
  ]);
  const mensagens: MensagemDaTela[] = conversa
    ? mensagensParaTela(await linhasDaConversa(prisma, usuario.id, conversa.id))
    : [];
  const perguntaInicial = conversa ? null : perguntaDoLink(pergunta);

  return (
    <div className="space-y-6">
      <Cabecalho />
      <ChatDoAssistente
        key={conversa?.id ?? `nova:${perguntaInicial ?? ""}`}
        conversaInicial={conversa ? { id: conversa.id, mensagens } : null}
        perguntaInicial={perguntaInicial}
        conversas={conversas}
        cota={cota}
      />
      <FormularioDoRamo ramo={usuario.ramo} cidade={cidadeDoEstudio(usuario.pixCidade)} />
    </div>
  );
}
