import type { Metadata } from "next";
import Link from "next/link";
import {
  Contatos,
  Item,
  Itens,
  NaTela,
  PaginaLegal,
  QuemResponde,
  Trecho,
} from "@/app/termos/texto-legal";
import { NOME_DO_PRODUTO } from "@/lib/site";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: `Quais dados o ${NOME_DO_PRODUTO} guarda, para quê, onde ficam e como você pede para ver, corrigir ou apagar.`,
  alternates: { canonical: "/privacidade" },
};

/*
  Este texto descreve o que o código faz de verdade. Mudou o que se guarda, onde
  se guarda ou quem processa (um fornecedor novo, um cookie novo), muda aqui
  também e atualiza a data.
*/
const ATUALIZADA_EM = "2026-10-15";

export default function PaginaPrivacidade() {
  return (
    <PaginaLegal
      titulo="Política de privacidade"
      atualizadaEm={ATUALIZADA_EM}
      outra={{ href: "/termos", rotulo: "Termos de uso" }}
      resumo={
        <p>
          Este texto explica, sem juridiquês, quais dados o {NOME_DO_PRODUTO} guarda, para
          que servem, onde ficam e o que você pode pedir. Em uma frase: guardamos só o
          necessário para o seu estúdio funcionar, não vendemos dados e não mostramos
          propaganda.
        </p>
      }
    >
      <Trecho id="quem-somos" titulo="Quem somos">
        <p>
          O {NOME_DO_PRODUTO} é um sistema de agendamento on-line para estúdios que
          atendem com hora marcada, oferecido por <QuemResponde />. Aqui, &ldquo;nós&rdquo;
          somos o {NOME_DO_PRODUTO}, e &ldquo;você&rdquo; é quem tem conta: a dona ou o
          dono do estúdio.
        </p>
        <p>Para qualquer assunto sobre os seus dados, fale com a gente:</p>
        <Contatos />
      </Trecho>

      <Trecho id="papeis" titulo="Os dados da sua conta e os dados dos seus clientes">
        <p>
          A Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018) separa quem decide
          sobre os dados, o <strong className="text-carvao">controlador</strong>, de quem
          cuida deles a pedido de outro, o <strong className="text-carvao">operador</strong>.
          No {NOME_DO_PRODUTO} existem os dois casos:
        </p>
        <Itens>
          <Item>
            <NaTela>Dados da sua conta</NaTela>, como nome, e-mail e WhatsApp: aqui o{" "}
            {NOME_DO_PRODUTO} é o controlador. Somos nós que decidimos como esses dados
            são usados e respondemos por isso.
          </Item>
          <Item>
            <NaTela>Dados dos clientes do seu estúdio</NaTela>, tudo o que você digita
            sobre as pessoas que atende: aqui quem decide é o seu estúdio, que é o
            controlador. O {NOME_DO_PRODUTO} é o operador: guarda e organiza esses dados
            só para você usar, do jeito que você usa no painel, e não faz mais nada com
            eles.
          </Item>
        </Itens>
      </Trecho>

      <Trecho id="o-que-guardamos" titulo="O que guardamos">
        <p>Da sua conta:</p>
        <Itens>
          <Item>
            nome, nome do estúdio, e-mail, WhatsApp, CPF ou CNPJ e, se você quiser, CEP
            e endereço do estúdio;
          </Item>
          <Item>a sua senha, só de forma embaralhada (veja &ldquo;Segurança&rdquo;);</Item>
          <Item>
            a chave Pix e a cidade que você cadastrar para cobrar os seus clientes, e as
            suas preferências, como os dias de lembrete e o percentual de imposto
            estimado;
          </Item>
          <Item>
            a assinatura: plano, validade, os avisos de Pix que você mandou e quando cada
            um foi confirmado;
          </Item>
          <Item>o código de quem indicou o {NOME_DO_PRODUTO}, se você chegou por indicação;</Item>
          <Item>os pedidos de senha nova.</Item>
        </Itens>

        <p>Do seu estúdio, o que você mesma digita ou envia:</p>
        <Itens>
          <Item>
            clientes: nome e telefone e, se você preencher, e-mail, CPF, endereço, data
            de nascimento e observações;
          </Item>
          <Item>
            serviços, horários da agenda, valores combinados, cobranças, lembretes que
            você enviou, entradas e saídas, contas a pagar e prazos de contrato;
          </Item>
          <Item>
            no plano VIP, os documentos que você envia para leitura (contratos, boletos,
            contas) e o que foi lido de cada um.
          </Item>
        </Itens>
        <p>
          No campo de observações cabe de tudo, inclusive informação de saúde, como uma
          alergia. Para a lei, esse é um dado sensível. Anote só o que for preciso para
          atender bem, e deixe o cliente saber que você anota. Se o seu estúdio atende
          crianças ou adolescentes, os dados deles pedem o cuidado do artigo 14 da LGPD,
          sempre no melhor interesse deles.
        </p>

        <p>Sem você digitar nada:</p>
        <Itens>
          <Item>o cookie que mantém você conectada (veja &ldquo;Cookies&rdquo;);</Item>
          <Item>
            registros técnicos que a hospedagem guarda de cada acesso, como endereço IP,
            navegador e horário, para manter o site no ar e protegido;
          </Item>
          <Item>
            as tentativas de entrada com senha errada, guardadas só como um resumo
            embaralhado do e-mail digitado, nunca a senha, para frear quem tenta
            adivinhar senhas.
          </Item>
        </Itens>
        <p>
          Não pedimos cartão de crédito e não buscamos dados dos seus clientes em lugar
          nenhum: o que existe deles no {NOME_DO_PRODUTO} foi você quem cadastrou.
        </p>
      </Trecho>

      <Trecho id="para-que" titulo="Para que usamos">
        <Itens>
          <Item>
            Para criar e manter a sua conta, deixar você entrar e mostrar os seus dados
            a você. É a execução do contrato que fazemos quando você cria a conta (art.
            7º, V, da LGPD).
          </Item>
          <Item>
            Para identificar a sua assinatura e conferir os Pix recebidos, e para guardar
            o registro desses pagamentos pelo tempo que a lei pedir (art. 7º, II).
          </Item>
          <Item>
            Para falar com você sobre a conta: pagamento, senha nova, mudanças
            importantes no serviço.
          </Item>
          <Item>
            Para manter o {NOME_DO_PRODUTO} seguro e evitar fraude, o que é do interesse
            legítimo de todo mundo que usa o sistema (art. 7º, IX).
          </Item>
        </Itens>
        <p>
          Não vendemos dados, não usamos os seus dados nem os dos seus clientes para
          propaganda e não mostramos anúncios.
        </p>
      </Trecho>

      <Trecho id="onde-ficam" titulo="Onde os dados ficam e quem nos ajuda">
        <p>
          O {NOME_DO_PRODUTO} usa poucos fornecedores, cada um para uma tarefa, e
          entrega a cada um só o que a tarefa pede:
        </p>
        <Itens>
          <Item>
            <NaTela>Supabase</NaTela>: guarda o banco de dados (PostgreSQL), na região de
            São Paulo (sa-east-1). Também guarda os documentos enviados, num espaço de
            arquivos privado.
          </Item>
          <Item>
            <NaTela>Netlify</NaTela>: hospeda o site e o painel, ou seja, é por onde
            passam as páginas que você abre.
          </Item>
          <Item>
            <NaTela>Anthropic</NaTela>: faz a leitura automática de documentos do plano
            VIP, e só quando você pede. O documento é enviado e processado pela API da
            Anthropic, que devolve o que encontrou. O {NOME_DO_PRODUTO} não autoriza o uso
            dos seus documentos para treinar inteligência artificial.
          </Item>
        </Itens>
        <p>
          Essas três empresas são dos Estados Unidos. O banco de dados fica no Brasil,
          mas parte do processamento, como a entrega das páginas e a leitura de
          documentos, pode acontecer fora do país.
        </p>
        <p>
          Quando você cobra ou lembra um cliente, o {NOME_DO_PRODUTO} abre o WhatsApp do
          seu aparelho com a mensagem pronta. Quem envia é você, pela sua conta do
          WhatsApp: o {NOME_DO_PRODUTO} não manda mensagens em seu nome. A assinatura é
          paga por um Pix feito no seu banco; não recebemos dados de cartão nem acesso
          à sua conta bancária.
        </p>
        <p>
          Fora isso, só entregamos dados a uma autoridade quando a lei obrigar, diante
          de um pedido válido.
        </p>
      </Trecho>

      <Trecho id="cookies" titulo="Cookies">
        <p>
          O {NOME_DO_PRODUTO} usa um único cookie, o que mantém você conectada depois de
          entrar. Ele é assinado digitalmente, para não poder ser falsificado, não pode
          ser lido por scripts da página e vale por até 30 dias, ou até você tocar em
          sair.
        </p>
        <p>
          Não usamos cookies de propaganda nem de análise, e não há ferramentas de
          terceiros seguindo você por outros sites. O navegador também guarda, no seu
          próprio aparelho, se você escolheu o tema claro ou o escuro. Essa escolha não
          vem para a gente.
        </p>
      </Trecho>

      <Trecho id="quanto-tempo" titulo="Por quanto tempo guardamos">
        <p>
          Enquanto a sua conta existir. Se a assinatura vencer, os dados continuam
          guardados, e tudo volta como estava quando o pagamento é confirmado.
        </p>
        <p>
          Você pode baixar uma cópia de tudo e apagar a conta quando quiser, em{" "}
          <Link href="/painel/conta" className="font-semibold text-terracota hover:underline">
            Minha conta
          </Link>
          , nos botões <NaTela>Baixar meus dados</NaTela> e{" "}
          <NaTela>Excluir minha conta</NaTela>. Ao excluir, apagamos a conta e tudo o que
          está nela: clientes, agenda, cobranças, finanças e documentos enviados. Isso não
          tem volta, por isso vale baixar a cópia antes.
        </p>
        <p>
          Os registros técnicos da hospedagem e as cópias de segurança automáticas do
          banco, quando existem, são substituídos no ciclo normal de cada fornecedor.
          Depois da exclusão, só guardamos o que a lei mandar guardar.
        </p>
      </Trecho>

      <Trecho id="seguranca" titulo="Segurança">
        <Itens>
          <Item>
            Senhas são guardadas com bcrypt, um embaralhamento de mão única: nem nós
            conseguimos ver a sua senha.
          </Item>
          <Item>
            A sessão fica num cookie assinado. Trocar a senha desconecta todos os outros
            aparelhos onde a conta estava aberta.
          </Item>
          <Item>
            O link de senha nova vale por meia hora e uma vez só, e guardamos apenas um
            resumo dele, que não serve para entrar.
          </Item>
          <Item>
            Depois de algumas senhas erradas seguidas no mesmo e-mail, a entrada espera
            alguns minutos antes de aceitar outra tentativa.
          </Item>
          <Item>
            Cada estúdio só enxerga os próprios dados: toda consulta ao banco é feita
            dentro do estúdio de quem está conectado, e testes automáticos conferem essa
            separação.
          </Item>
          <Item>
            Os documentos ficam num espaço privado, numa pasta do próprio estúdio, e só
            abrem por links assinados que expiram em poucos minutos, criados depois de
            conferir que o documento é seu.
          </Item>
          <Item>Todo acesso ao site passa por conexão criptografada (HTTPS).</Item>
        </Itens>
        <p>
          Nenhum sistema é à prova de tudo. Se acontecer um incidente de segurança que
          possa trazer risco ou dano relevante, avisamos você e a Autoridade Nacional de
          Proteção de Dados (ANPD), como pede a lei.
        </p>
      </Trecho>

      <Trecho id="seus-direitos" titulo="Seus direitos">
        <p>Pelo artigo 18 da LGPD, você pode pedir a qualquer momento:</p>
        <Itens>
          <Item>a confirmação de que tratamos dados seus, e acesso a eles;</Item>
          <Item>a correção de dados incompletos, errados ou desatualizados;</Item>
          <Item>
            a anonimização, o bloqueio ou a eliminação de dados desnecessários, excessivos
            ou tratados fora do que a lei permite;
          </Item>
          <Item>a portabilidade dos dados para outro fornecedor;</Item>
          <Item>a eliminação dos dados tratados com o seu consentimento;</Item>
          <Item>a informação de com quem compartilhamos os seus dados;</Item>
          <Item>
            a informação sobre a possibilidade de não dar consentimento, e o que acontece
            se você não der;
          </Item>
          <Item>a revogação do consentimento, quando ele for a base do uso.</Item>
        </Itens>
        <p>
          Boa parte você faz sozinha, no painel: corrigir os seus dados, baixar uma cópia
          de tudo e excluir a conta. Para o resto, escreva para um dos contatos no começo
          desta página. Respondemos em até 15 dias e, para proteger a sua conta, podemos
          pedir que o pedido venha do e-mail ou do WhatsApp do cadastro. Você também pode
          reclamar diretamente à ANPD.
        </p>
        <p>
          <strong className="text-carvao">É cliente de um estúdio que usa o {NOME_DO_PRODUTO}?</strong>{" "}
          Quem decide sobre os seus dados é o estúdio, então fale primeiro com ele. Se
          escrever para nós, encaminhamos o pedido ao estúdio e ajudamos no que for
          preciso para ele responder.
        </p>
      </Trecho>

      <Trecho id="mudancas" titulo="Mudanças nesta política">
        <p>
          Quando mudarmos algo importante, avisamos pelo e-mail ou pelo WhatsApp do
          cadastro antes de a mudança valer, e a data no alto desta página muda junto.
        </p>
      </Trecho>
    </PaginaLegal>
  );
}
