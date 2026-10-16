import type { Metadata } from "next";
import Link from "next/link";
import { PaginaLegal, Revisar, Secao } from "@/componentes/pagina-legal";
import { PAGINAS_MAXIMAS, TAMANHO_MAXIMO_BYTES } from "@/lib/arquivos";
import { RESPONSAVEL, emailDeContatoValido } from "@/lib/contato";
import { DIAS_DE_RETENCAO } from "@/lib/ia/conversas";
import { MINUTOS_DE_VALIDADE } from "@/lib/senha";
import { NOME_DO_PRODUTO } from "@/lib/site";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description:
    "Como o Bossa trata dados pessoais: quem é controlador e operador, o que vai para a inteligência artificial, por quanto tempo os dados ficam e como pedir acesso ou exclusão.",
  alternates: { canonical: "/privacidade" },
};

/**
 * A política de privacidade, escrita a partir do que o código faz hoje.
 *
 * Cada afirmação aqui tem um lugar no código que a sustenta (o que vai para a
 * IA em lib/ia, a retenção das conversas em lib/ia/conversas.ts, o apagar e o
 * anonimizar em lib/cliente-operacoes.ts e lib/equipe-operacoes.ts). Se uma
 * dessas regras mudar, este texto precisa mudar junto.
 *
 * Os trechos marcados [REVISAR COM ADVOGADO] e [PREENCHER] precisam passar por
 * revisão jurídica antes de a página valer como versão final.
 */

const SUMARIO = [
  { id: "papeis", titulo: "Quem responde pelos dados" },
  { id: "dados", titulo: "Quais dados o Bossa guarda" },
  { id: "finalidade", titulo: "Para que os dados são usados" },
  { id: "ia", titulo: "Inteligência artificial" },
  { id: "fornecedores", titulo: "Quem mais trata os dados" },
  { id: "quem-ve", titulo: "Quem vê o quê" },
  { id: "seguranca", titulo: "Segurança" },
  { id: "prazos", titulo: "Por quanto tempo" },
  { id: "direitos", titulo: "Seus direitos e como pedir" },
  { id: "cookies", titulo: "Cookies" },
  { id: "contato", titulo: "Contato e encarregado" },
  { id: "mudancas", titulo: "Mudanças nesta política" },
];

const MEGABYTES = Math.round(TAMANHO_MAXIMO_BYTES / (1024 * 1024));

export default function PaginaPrivacidade() {
  return (
    <PaginaLegal
      titulo="Política de privacidade"
      atualizadaEm="16 de outubro de 2026"
      sumario={SUMARIO}
      resumo={
        <>
          <p className="font-semibold">Em poucas linhas</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm">
            <li>
              Os dados dos clientes e da equipe são do estúdio que usa o {NOME_DO_PRODUTO}. Nós só
              guardamos e processamos esses dados para o sistema funcionar.
            </li>
            <li>Não vendemos dados e não usamos cookies de propaganda.</li>
            <li>
              A inteligência artificial só funciona no plano Completo e só quando você usa. O assistente
              e a classificação de custos nunca recebem nome, telefone ou CPF dos seus clientes. A
              leitura de documentos lê o arquivo que você enviar.
            </li>
            <li>Você pode corrigir ou apagar dados nas próprias telas, ou pedir pelo contato.</li>
          </ul>
        </>
      }
    >
      <Secao id="papeis" titulo="1. Quem responde pelos dados">
        <p>
          O {NOME_DO_PRODUTO} é um sistema de agenda, cobrança e finanças para estúdios e
          profissionais que atendem com hora marcada. Cada conta é de um estúdio.
        </p>
        <ul>
          <li>
            <strong>O estúdio é o controlador</strong> dos dados dos clientes dele e da equipe dele.
            É ele quem decide o que cadastrar, para quê e por quanto tempo.
          </li>
          <li>
            <strong>O {NOME_DO_PRODUTO} é o operador</strong> desses dados: guarda e processa seguindo
            as instruções do estúdio, só para fazer o sistema funcionar.
          </li>
          <li>
            <strong>O {NOME_DO_PRODUTO} é o controlador</strong> dos dados da própria conta (nome,
            e-mail, telefone, CPF ou CNPJ de quem assina) e dos pagamentos da assinatura.
          </li>
        </ul>
        <p>
          <Revisar />
        </p>
      </Secao>

      <Secao id="dados" titulo="2. Quais dados o Bossa guarda">
        <ul>
          <li>
            <strong>Da conta:</strong> nome, nome do negócio, e-mail, telefone, CPF ou CNPJ e,
            quando informados, CEP, endereço, ramo, chave Pix e cidade da chave. A senha é guardada
            só como um resumo que não se desfaz (bcrypt). Também guardamos os avisos de pagamento
            da assinatura e, se houver, o código de quem indicou.
          </li>
          <li>
            <strong>Dos clientes do estúdio:</strong> nome e WhatsApp e, quando o estúdio informa,
            e-mail, CPF, endereço, data de nascimento e observações. Também os horários, os serviços,
            as cobranças e o registro dos lembretes de cobrança enviados.
          </li>
          <li>
            <strong>Da equipe do estúdio:</strong> nome, cargo, tipo de vínculo, datas de início e
            fim, remuneração combinada, pagamentos registrados, ausências (tipo e período) e, quando
            informados, CPF ou CNPJ, chave Pix, telefone, e-mail e observações. Atestado entra só como
            período, sem diagnóstico nem outro dado de saúde.
          </li>
          <li>
            <strong>Documentos enviados para leitura:</strong> o arquivo (PDF ou foto, até{" "}
            {MEGABYTES} MB e {PAGINAS_MAXIMAS} páginas) e o que foi lido dele: tipo, partes, resumo,
            datas e valores. Um contrato pode trazer dados de outras pessoas, como o nome e o CPF do
            locador.
          </li>
          <li>
            <strong>Agendamento pelo link:</strong> o nome e o WhatsApp que o cliente digita. Para
            conter abuso, cada tentativa guarda o endereço IP e o telefone embaralhados, de um jeito
            que não dá para desfazer.
          </li>
          <li>
            <strong>Assistente:</strong> as conversas (perguntas e respostas) e o registro de uso da
            IA (data, função usada e quantidade de processamento).
          </li>
          <li>
            <strong>Link do contador:</strong> só o resumo do código de acesso, a data de criação e
            a do último acesso. Tentativas erradas guardam o IP embaralhado.
          </li>
        </ul>
        <p>
          O {NOME_DO_PRODUTO} <strong>não é prontuário</strong>. Não registre diagnóstico, CID,
          tratamento nem outro dado de saúde nas observações de clientes ou da equipe.
        </p>
      </Secao>

      <Secao id="finalidade" titulo="3. Para que os dados são usados">
        <ul>
          <li>Fazer a agenda, as cobranças, as finanças e os relatórios funcionarem.</li>
          <li>Montar as mensagens de cobrança que o estúdio envia pelo WhatsApp.</li>
          <li>Conferir e liberar a assinatura.</li>
          <li>Proteger o sistema contra abuso, como tentativas repetidas no link de agendamento.</li>
          <li>Cumprir obrigações legais.</li>
        </ul>
        <p>
          Não usamos os dados para propaganda, não vendemos dados e não montamos perfil de clientes
          do estúdio.
        </p>
        <p>
          As bases legais são a execução do contrato com quem assina, o cumprimento de obrigação
          legal e o legítimo interesse na segurança do sistema. Para os dados de clientes e da
          equipe, a base legal é definida pelo estúdio, que é o controlador. <Revisar />
        </p>
      </Secao>

      <Secao id="ia" titulo="4. Inteligência artificial">
        <p>
          Três funções do plano Completo usam o Claude, da Anthropic. Elas só rodam quando o estúdio usa.
          O resultado é sempre uma sugestão: nada entra no financeiro sem alguém conferir.
        </p>
        <ul>
          <li>
            <strong>Leitura de documentos:</strong> quando você manda ler, o arquivo inteiro vai para
            a IA, porque é preciso ler o papel para achar datas e valores. Envie só o que precisa ser
            lido e evite documentos com dados de saúde.
          </li>
          <li>
            <strong>Classificação de custos:</strong> primeiro valem as regras automáticas do
            próprio {NOME_DO_PRODUTO}. O que sobrar vai para a IA com a descrição da despesa sem CPF,
            CNPJ, telefone, e-mail, chave Pix e nomes de pessoas, cortada em 200 caracteres, mais a
            categoria e o valor.
          </li>
          <li>
            <strong>Assistente:</strong> recebe a pergunta como você escreveu e números calculados no{" "}
            {NOME_DO_PRODUTO}: faturamento, despesas por categoria, ocupação da agenda, contagem de
            clientes e o total pago à equipe por tipo de pagamento. Para pesquisar tendências na
            internet, usa só o ramo e a cidade. Antes da primeira pergunta, o estúdio lê um aviso e
            aceita.
          </li>
        </ul>
        <p>
          <strong>O que nunca vai para o assistente nem para a classificação:</strong> nome,
          telefone, e-mail, CPF, endereço ou observações de clientes; o histórico de um cliente; nome,
          CPF, chave Pix ou valor pago a uma pessoa da equipe; o nome do negócio; a senha. Não
          escreva dados de clientes na pergunta ao assistente.
        </p>
        <p>
          O processamento acontece fora do Brasil, em servidores da Anthropic. Isso é uma
          transferência internacional de dados (LGPD, arts. 33 a 36). <Revisar /> Pelos termos
          comerciais da Anthropic, o que é enviado pela API não é usado para treinar modelos.{" "}
          <Revisar>REVISAR COM ADVOGADO: conferir termos e prazo de retenção do fornecedor</Revisar>
        </p>
        <p>
          A IA não toma decisão sobre pessoas: ela não avalia, não compara e não sugere desligar
          ninguém da equipe.
        </p>
      </Secao>

      <Secao id="fornecedores" titulo="5. Quem mais trata os dados">
        <p>
          O {NOME_DO_PRODUTO} usa estes fornecedores como suboperadores. Cada um recebe só o que
          precisa para funcionar:
        </p>
        <ul>
          <li>
            <strong>Netlify:</strong> hospedagem do site. As páginas e as funções do sistema rodam
            nos servidores dela, que também registram dados técnicos de acesso, como IP e
            navegador. <Revisar>REVISAR: região dos servidores e transferência internacional</Revisar>
          </li>
          <li>
            <strong>Supabase:</strong> banco de dados, onde ficam todos os cadastros, e o espaço
            privado onde ficam os documentos enviados.{" "}
            <Revisar>PREENCHER: região do projeto no Supabase</Revisar>
          </li>
          <li>
            <strong>Anthropic:</strong> a inteligência artificial das três funções descritas acima,
            com processamento fora do Brasil.
          </li>
        </ul>
        <p>
          A assinatura do {NOME_DO_PRODUTO} é paga por Pix direto para a nossa chave, sem
          empresa de pagamento no meio. As cobranças que o estúdio manda para os clientes dele saem pelo WhatsApp
          do próprio estúdio: o {NOME_DO_PRODUTO} só monta a mensagem e o código Pix, e o dinheiro vai
          direto para a chave do estúdio.
        </p>
      </Secao>

      <Secao id="quem-ve" titulo="6. Quem vê o quê">
        <ul>
          <li>
            <strong>A dona da conta</strong> vê tudo o que foi cadastrado nela. Uma conta nunca
            enxerga os dados de outra.
          </li>
          <li>
            <strong>O contador</strong>, pelo link que o estúdio gera, vê o relatório do mês e baixa
            a planilha. O relatório não traz nome, telefone nem CPF de clientes. O estúdio pode
            desligar o link quando quiser.
          </li>
          <li>
            <strong>O cliente que marca pelo link</strong> vê o nome do estúdio, os serviços, os
            horários livres, o endereço e o WhatsApp do estúdio. Ele não vê quem mais marcou.
          </li>
          <li>
            <strong>Quem administra o {NOME_DO_PRODUTO}</strong> vê os dados da conta, os avisos de
            pagamento da assinatura e os pedidos de nova senha, e só acessa outros dados quando for
            preciso para suporte pedido pelo estúdio ou por obrigação legal. <Revisar />
          </li>
        </ul>
      </Secao>

      <Secao id="seguranca" titulo="7. Segurança">
        <ul>
          <li>Toda consulta ao banco é filtrada pela conta de quem está usando.</li>
          <li>
            A senha, o código de nova senha (que vale {MINUTOS_DE_VALIDADE} minutos e uma vez só) e o
            código do contador são guardados só como resumo, que não se desfaz.
          </li>
          <li>
            Os documentos ficam num espaço privado. O envio usa um endereço temporário, gerado só
            depois de conferir que o documento é da conta.
          </li>
          <li>
            O link de agendamento e o link do contador têm limite de tentativas, para dificultar
            abuso.
          </li>
        </ul>
        <p>
          Nenhum sistema é totalmente imune a falhas. Se houver um incidente de segurança que possa
          causar risco ou dano relevante, avisamos os estúdios afetados e a Autoridade Nacional de
          Proteção de Dados (ANPD), como pede a LGPD. <Revisar />
        </p>
      </Secao>

      <Secao id="prazos" titulo="8. Por quanto tempo">
        <ul>
          <li>
            <strong>Cadastros, agenda, cobranças e finanças:</strong> enquanto a conta existir. Se a
            assinatura vencer, o acesso pausa e os dados continuam guardados para quando o estúdio
            voltar. <Revisar>REVISAR COM ADVOGADO: prazo máximo de guarda de conta parada</Revisar>
          </li>
          <li>
            <strong>Conta encerrada a pedido:</strong> os dados são apagados em até{" "}
            <strong>[EXEMPLO: 30 dias]</strong>, menos o que a lei obrigar a guardar. <Revisar />
          </li>
          <li>
            <strong>Conversas com o assistente:</strong> apagadas depois de {DIAS_DE_RETENCAO} dias
            sem uso. O estúdio pode apagar qualquer conversa antes.
          </li>
          <li>
            <strong>Registro de uso da IA:</strong> enquanto a conta existir, para a contagem da
            franquia do plano. <Revisar>PREENCHER: prazo de guarda</Revisar>
          </li>
          <li>
            <strong>Documentos:</strong> até o estúdio apagar. Apagar o documento apaga o arquivo
            junto.
          </li>
          <li>
            <strong>Tentativas no link de agendamento e no link do contador:</strong> apagadas
            depois de 24 horas.
          </li>
          <li>
            <strong>Cliente apagado:</strong> sai com os horários e as cobranças dele. Se ele tiver
            atendimento concluído ou cobrança paga num mês já fechado, o {NOME_DO_PRODUTO} pede para
            reabrir o mês antes, para o fechamento não mudar por baixo.
          </li>
          <li>
            <strong>Pessoa da equipe removida:</strong> sem pagamento registrado, o cadastro sai
            inteiro. Com pagamento, o nome vira &ldquo;Ex-colaborador&rdquo;, somem CPF, chave Pix,
            contato, observações e ausências, e ficam só os valores pagos, que o contador precisa.
          </li>
        </ul>
        <p>
          Os prazos de guarda de registros financeiros e trabalhistas devem seguir a orientação do
          contador do estúdio. <Revisar />
        </p>
      </Secao>

      <Secao id="direitos" titulo="9. Seus direitos e como pedir">
        <p>
          A LGPD (art. 18) garante: confirmação de que há tratamento, acesso, correção, anonimização
          ou eliminação de dados desnecessários, portabilidade, informação sobre com quem os dados
          são compartilhados e revogação do consentimento, quando ele for a base.
        </p>
        <ul>
          <li>
            <strong>Se você é cliente ou faz parte da equipe de um estúdio:</strong> fale primeiro
            com o estúdio, que é o controlador. O {NOME_DO_PRODUTO} ajuda o estúdio a responder.
          </li>
          <li>
            <strong>Se você é o estúdio:</strong> corrija ou apague os dados nas próprias telas
            (Clientes, Equipe, Documentos, Assistente). No plano Completo, o relatório do mês sai em planilha.
            Para receber uma cópia completa dos dados ou encerrar a conta, peça pelo contato abaixo.
          </li>
        </ul>
        <p>
          Respondemos em até <strong>[EXEMPLO: 15 dias]</strong>. <Revisar /> Você também pode
          reclamar à ANPD.
        </p>
      </Secao>

      <Secao id="cookies" titulo="10. Cookies">
        <p>
          O {NOME_DO_PRODUTO} usa um único cookie, necessário para manter você conectado (dura até 30
          dias ou até você sair). A escolha de tema claro ou escuro fica guardada no próprio
          navegador. Não há cookies de propaganda nem ferramentas de rastreamento de terceiros.
        </p>
      </Secao>

      <Secao id="contato" titulo="11. Contato e encarregado">
        <p>
          O {NOME_DO_PRODUTO} é oferecido por <strong>{RESPONSAVEL.nome}</strong>, CPF ou CNPJ{" "}
          <strong>{RESPONSAVEL.documento}</strong>.
        </p>
        <p>
          Encarregado de dados: <strong>{RESPONSAVEL.encarregado}</strong>. Contato:{" "}
          {emailDeContatoValido() ? (
            <a
              href={`mailto:${RESPONSAVEL.email}`}
              className="font-semibold text-terracota underline-offset-4 hover:underline"
            >
              {RESPONSAVEL.email}
            </a>
          ) : (
            <strong>{RESPONSAVEL.email}</strong>
          )}
          . <Revisar>REVISAR COM ADVOGADO: dispensa de encarregado para agente de pequeno porte</Revisar>
        </p>
      </Secao>

      <Secao id="mudancas" titulo="12. Mudanças nesta política">
        <p>
          Quando esta política mudar, a data no topo muda junto.{" "}
          <Revisar>REVISAR COM ADVOGADO: como avisar mudanças importantes</Revisar> Leia também os{" "}
          <Link href="/termos" className="font-semibold text-terracota hover:underline">
            Termos de uso
          </Link>
          .
        </p>
      </Secao>
    </PaginaLegal>
  );
}
