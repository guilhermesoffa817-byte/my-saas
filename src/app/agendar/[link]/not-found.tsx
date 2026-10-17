/**
 * Link que não existe ou que o estúdio desligou. Quem chega aqui é cliente de
 * um estúdio, não do Bossa: a saída é falar com o estúdio, não ir para a
 * página de vendas.
 */
export default function AgendaNaoEncontrada() {
  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <h1 className="font-display text-2xl font-semibold text-carvao">
        Esta página de agendamento não está disponível
      </h1>
      <p className="mt-2 leading-relaxed text-carvao-suave">
        Confira se o endereço está certinho ou peça o link de novo para o estúdio.
      </p>
    </div>
  );
}
