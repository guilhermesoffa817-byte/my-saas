import { BotaoConfirmar, BotaoEnviar } from "@/componentes/ui/botao";
import { perguntaParaTirarDaLista } from "@/lib/historico";
import { desarquivarCliente, excluirCliente } from "./acoes";

/**
 * O botão que tira a cliente da lista.
 *
 * A palavra muda com o histórico porque o efeito muda: quem já tem atendimento
 * ou cobrança é arquivada e continua contando no faturamento; quem não tem
 * nada é apagada de vez. A pergunta diz qual dos dois vai acontecer antes do
 * toque, e quantos horários marcados serão cancelados junto. A ação no
 * servidor confere tudo de novo na hora de fazer.
 */
export function BotaoTirarDaLista({
  id,
  nome,
  comHistorico,
  horariosMarcados,
  voltarParaLista = false,
}: {
  id: string;
  nome: string;
  comHistorico: boolean;
  /** Horários de pé daqui para a frente, que o arquivamento cancela. */
  horariosMarcados: number;
  voltarParaLista?: boolean;
}) {
  return (
    <form action={excluirCliente}>
      <input type="hidden" name="id" value={id} />
      {voltarParaLista ? <input type="hidden" name="voltarParaLista" value="1" /> : null}
      <BotaoConfirmar
        pergunta={perguntaParaTirarDaLista({ nome, comHistorico, horariosMarcados })}
        className="text-rose-700 hover:border-rose-300 hover:text-rose-700"
      >
        {comHistorico ? "Arquivar" : "Apagar"}
      </BotaoConfirmar>
    </form>
  );
}

export function BotaoDesarquivar({ id }: { id: string }) {
  return (
    <form action={desarquivarCliente}>
      <input type="hidden" name="id" value={id} />
      <BotaoEnviar variante="suave" enviando="Desarquivando...">
        Desarquivar
      </BotaoEnviar>
    </form>
  );
}
