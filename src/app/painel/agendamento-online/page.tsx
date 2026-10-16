import { prisma } from "@/lib/prisma";
import { exigirLeitura } from "@/lib/guardas";
import { podeUsar } from "@/lib/recursos";
import { qrCodeSvg } from "@/lib/qrcode";
import { ENDERECO_DO_SITE } from "@/lib/site";
import { emReais } from "@/lib/formato";
import { telefoneParaWhatsApp } from "@/lib/telefone";
import { Cartao, Secao, TituloDaTela } from "@/componentes/ui/cartao";
import { BotaoCopiar } from "@/componentes/ui/botao";
import { Aviso, Etiqueta } from "@/componentes/ui/etiqueta";
import { ANTECEDENCIAS, sugerirLink } from "@/lib/agendamento-online/configuracao";
import { minutosParaHora } from "@/lib/agendamento-online/disponibilidade";
import { BotaoLigar, FormularioDaAgenda, type FaixaDoFormulario } from "./formulario";

export const metadata = { title: "Agendamento online" };
export const dynamic = "force-dynamic";

/** Começo sugerido para quem ainda não configurou: seg a sex com almoço, sábado de manhã. */
const SEMANA_SUGERIDA: FaixaDoFormulario[] = [
  ...[1, 2, 3, 4, 5].flatMap((diaDaSemana) => [
    { diaDaSemana, inicio: "09:00", fim: "12:00" },
    { diaDaSemana, inicio: "13:00", fim: "18:00" },
  ]),
  { diaDaSemana: 6, inicio: "09:00", fim: "13:00" },
];

/**
 * Um endereço livre a partir do nome do negócio. Se "estudio-bela-pele" já for
 * de outra conta, tenta "estudio-bela-pele-2" e assim por diante.
 */
async function linkLivre(nomeDoNegocio: string) {
  const base = sugerirLink(nomeDoNegocio);
  for (let tentativa = 1; tentativa <= 5; tentativa++) {
    const candidato = tentativa === 1 ? base : `${base.slice(0, 37)}-${tentativa}`;
    const ocupado = await prisma.agendaOnline.findUnique({
      where: { link: candidato },
      select: { id: true },
    });
    if (!ocupado) return candidato;
  }
  return base;
}

export default async function PaginaAgendamentoOnline() {
  const { usuario } = await exigirLeitura();
  const comEquipe = podeUsar(usuario, "equipe");

  const [config, faixas, servicos, pessoas] = await Promise.all([
    prisma.agendaOnline.findUnique({ where: { usuarioId: usuario.id } }),
    prisma.faixaDeAtendimento.findMany({
      where: { usuarioId: usuario.id },
      orderBy: [{ diaDaSemana: "asc" }, { inicioMin: "asc" }],
    }),
    prisma.servico.findMany({
      where: { usuarioId: usuario.id, ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, precoCentavos: true, duracaoMin: true, agendavelOnline: true },
    }),
    comEquipe
      ? prisma.colaborador.count({ where: { usuarioId: usuario.id, anonimizadoEm: null, fim: null } })
      : Promise.resolve(0),
  ]);

  const link = config?.link ?? (await linkLivre(usuario.nomeNegocio));
  const prefixo = `${ENDERECO_DO_SITE.replace(/^https?:\/\//, "")}/agendar/`;
  const endereco = `${ENDERECO_DO_SITE}/agendar/${link}`;
  const qr = config ? await qrCodeSvg(endereco) : null;
  // O mesmo teste da página pública: só vira botão o telefone que o WhatsApp aceita.
  const whatsappPublico = telefoneParaWhatsApp(usuario.telefone).certo;

  const faixasDoFormulario: FaixaDoFormulario[] = config
    ? faixas.map((faixa) => ({
        diaDaSemana: faixa.diaDaSemana,
        inicio: minutosParaHora(faixa.inicioMin),
        // O campo de hora do celular não mostra 24:00; meia-noite volta como 23:59.
        fim: faixa.fimMin >= 1440 ? "23:59" : minutosParaHora(faixa.fimMin),
      }))
    : SEMANA_SUGERIDA;

  return (
    <div className="space-y-7">
      <TituloDaTela explicacao="Um link para o cliente escolher o serviço, o dia e o horário sozinho, a qualquer hora. O horário cai direto na sua agenda.">
        Agendamento online
      </TituloDaTela>

      <Secao titulo="Seu link">
        <Cartao destaque={config?.ativa}>
          {config ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Etiqueta tom={config.ativa ? "boa" : "calma"}>
                  {config.ativa ? "No ar" : "Desligada"}
                </Etiqueta>
                <span className="text-sm text-carvao-suave">
                  {config.ativa
                    ? "Quem tiver o link já consegue marcar."
                    : "Quem abrir o link vê que a página não está disponível."}
                </span>
              </div>

              <p className="rounded-xl bg-areia/60 px-4 py-3 font-semibold break-all text-carvao">
                {endereco}
              </p>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <BotaoCopiar texto={endereco} rotulo="Copiar link" copiado="Link copiado" className="w-full sm:w-auto" />
                <a
                  href={`/agendar/${link}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="botao-suave w-full sm:w-auto"
                >
                  Abrir a página
                </a>
                <BotaoLigar ligada={config.ativa} />
              </div>

              {qr ? (
                <div className="flex flex-col items-center gap-3 border-t border-areia-escura/60 pt-4 sm:flex-row sm:items-start">
                  <div
                    className="h-40 w-40 shrink-0 overflow-hidden rounded-xl border border-areia-escura bg-white p-2"
                    role="img"
                    aria-label="QR code do seu link de agendamento"
                    dangerouslySetInnerHTML={{ __html: qr }}
                  />
                  <p className="text-sm leading-relaxed text-carvao-suave">
                    Imprima e deixe no balcão, ou poste nos stories e na bio do
                    Instagram. Quem apontar a câmera do celular cai direto na sua
                    página de agendamento.
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <Aviso tom="espera">
              Escolha o endereço e os horários abaixo e salve. Depois é só colocar
              a página no ar e mandar o link.
            </Aviso>
          )}
        </Cartao>
      </Secao>

      <Secao
        titulo="Como a página funciona"
        explicacao="O cliente escolhe o serviço, o dia e um horário livre, e deixa nome e WhatsApp. Se o telefone já estiver na sua lista, o Bossa usa a mesma ficha."
      >
        <Cartao>
          {/*
            A página é pública: a dona precisa saber o que dela vai para lá antes
            de divulgar. O endereço e o telefone saem do cadastro da conta.
          */}
          <p className="mb-5 text-sm leading-relaxed text-carvao-suave">
            Quem abre o link vê o nome do negócio
            {usuario.endereco ? (
              <>
                , o endereço do seu cadastro (<strong className="text-carvao">{usuario.endereco}</strong>)
              </>
            ) : null}
            {whatsappPublico ? " e um botão para falar com você no WhatsApp do cadastro" : null}. Os
            horários já marcados aparecem só como ocupados, sem nome de cliente.
          </p>
          <FormularioDaAgenda
            link={link}
            prefixo={prefixo}
            faixas={faixasDoFormulario}
            antecedenciaMin={config?.antecedenciaMin ?? 120}
            diasAFrente={config?.diasAFrente ?? 30}
            antecedencias={ANTECEDENCIAS}
            servicos={servicos.map((servico) => ({
              id: servico.id,
              nome: servico.nome,
              detalhe: `${servico.duracaoMin} min · ${emReais(servico.precoCentavos)}`,
              marcado: servico.agendavelOnline,
            }))}
            equipe={
              comEquipe
                ? {
                    escolherQuemAtende: config?.escolherQuemAtende ?? false,
                    donaAtende: config?.donaAtende ?? true,
                    pessoas,
                  }
                : null
            }
          />
        </Cartao>
      </Secao>
    </div>
  );
}
