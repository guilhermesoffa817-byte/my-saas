import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirRecurso } from "@/lib/guardas";
import { LEITURAS_POR_MES_NO_VIP } from "@/lib/recursos";
import { Cartao, Secao, TituloDaTela } from "@/componentes/ui/cartao";
import { Vazio } from "@/componentes/ui/estados";
import {
  Aviso,
  Etiqueta,
  ROTULO_DO_DOCUMENTO,
  TOM_DO_DOCUMENTO,
} from "@/componentes/ui/etiqueta";
import { BotaoConfirmar } from "@/componentes/ui/botao";
import { dataEHora } from "@/lib/formato";
import { agoraDoPedido } from "@/lib/agora";
import { TAMANHO_MAXIMO_BYTES, envioConfigurado } from "@/lib/arquivos";
import { EnvioDeDocumento } from "./envio";
import { BotaoReler } from "./releitura";
import { excluirDocumento, leiturasDoMes } from "./acoes";

export const metadata = { title: "Documentos" };
export const dynamic = "force-dynamic";

/** Depois disso, uma leitura que ainda diz "lendo" claramente parou no meio. */
const MINUTOS_ATE_DESISTIR = 5;

export default async function PaginaDocumentos() {
  const { usuario } = await exigirRecurso("documentos");

  const [documentos, usadas] = await Promise.all([
    prisma.documento.findMany({
      where: { usuarioId: usuario.id },
      orderBy: { criadoEm: "desc" },
      take: 50,
      select: {
        id: true,
        nome: true,
        situacao: true,
        motivoDaFalha: true,
        tipoDeDocumento: true,
        leituraEm: true,
        criadoEm: true,
        _count: { select: { itens: true } },
      },
    }),
    leiturasDoMes(usuario.id),
  ]);

  const podeEnviar = envioConfigurado();
  const temChave = Boolean(process.env.ANTHROPIC_API_KEY);
  const agora = agoraDoPedido().getTime();

  return (
    <div className="space-y-7">
      <TituloDaTela explicacao="Envie um contrato ou uma conta e o Bossa lê para você. Nada entra no financeiro sem a sua conferência.">
        Documentos
      </TituloDaTela>

      {!podeEnviar ? (
        <Aviso tom="atencao">
          O envio de arquivos ainda não está configurado nesta conta. Enquanto
          isso, você pode guardar as contas à mão em{" "}
          <Link href="/painel/vencimentos" className="font-semibold underline">
            Vencimentos
          </Link>
          .
        </Aviso>
      ) : !temChave ? (
        <Aviso tom="atencao">
          A leitura automática ainda não está ativa nesta conta. Você pode
          guardar o documento aqui, mas os vencimentos precisam ser criados à mão
          em{" "}
          <Link href="/painel/vencimentos" className="font-semibold underline">
            Vencimentos
          </Link>
          .
        </Aviso>
      ) : null}

      {podeEnviar ? (
        <EnvioDeDocumento
          limiteMb={Math.round(TAMANHO_MAXIMO_BYTES / 1024 / 1024)}
          restam={Math.max(0, LEITURAS_POR_MES_NO_VIP - usadas)}
        />
      ) : null}

      <Secao titulo="Seus documentos">
        {documentos.length === 0 ? (
          <Vazio
            titulo="Nenhum documento ainda"
            texto="Envie o contrato do aluguel ou a conta de luz, e o Bossa encontra os valores e as datas para você conferir."
          />
        ) : (
          <ul className="space-y-3">
            {documentos.map((documento) => {
              /* "Lendo" há muito tempo quer dizer que a leitura foi cortada no meio. */
              const travou =
                documento.situacao === "lendo" &&
                documento.leituraEm !== null &&
                agora - documento.leituraEm.getTime() > MINUTOS_ATE_DESISTIR * 60 * 1000;

              const situacao = travou ? "falhou" : documento.situacao;

              return (
                <li key={documento.id}>
                  <Cartao>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-carvao">{documento.nome}</p>
                        <p className="mt-0.5 text-sm text-carvao-suave">
                          {documento.tipoDeDocumento ?? "Enviado"} ·{" "}
                          {dataEHora(documento.criadoEm)}
                          {documento._count.itens > 0
                            ? ` · ${documento._count.itens} ${documento._count.itens === 1 ? "item" : "itens"}`
                            : ""}
                        </p>
                      </div>
                      <Etiqueta tom={TOM_DO_DOCUMENTO[situacao] ?? "calma"}>
                        {ROTULO_DO_DOCUMENTO[situacao] ?? situacao}
                      </Etiqueta>
                    </div>

                    {travou ? (
                      <p className="mt-2 text-sm leading-relaxed text-carvao-suave">
                        A leitura parou no meio. Seu arquivo está guardado; é só
                        pedir de novo.
                      </p>
                    ) : documento.motivoDaFalha ? (
                      <p className="mt-2 text-sm leading-relaxed text-carvao-suave">
                        {documento.motivoDaFalha}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {situacao === "pronto" || situacao === "conferido" ? (
                        <Link href={`/painel/documentos/${documento.id}`} className="botao">
                          {situacao === "pronto" ? "Conferir" : "Ver o que foi lido"}
                        </Link>
                      ) : null}

                      {situacao === "falhou" && temChave ? (
                        <BotaoReler documentoId={documento.id} />
                      ) : null}

                      <form action={excluirDocumento}>
                        <input type="hidden" name="id" value={documento.id} />
                        <BotaoConfirmar
                          pergunta={`Apagar "${documento.nome}"? O arquivo sai junto, e isso não tem volta.`}
                          className="text-rose-700 hover:border-rose-300 hover:text-rose-700"
                        >
                          Apagar
                        </BotaoConfirmar>
                      </form>
                    </div>
                  </Cartao>
                </li>
              );
            })}
          </ul>
        )}
      </Secao>

      <p className="text-xs leading-relaxed text-carvao-suave">
        Leituras usadas neste mês: {usadas} de {LEITURAS_POR_MES_NO_VIP}.
      </p>
    </div>
  );
}
