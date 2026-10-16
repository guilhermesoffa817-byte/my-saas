/**
 * Link errado, revogado ou que nunca existiu: a mesma resposta para todos,
 * para ninguém de fora descobrir se um endereço já valeu um dia.
 */
export default function ContadorNaoEncontrado() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
      <h1 className="font-display text-2xl font-semibold text-carvao">Link não disponível</h1>
      <p className="mt-2 leading-relaxed text-carvao-suave">
        Este link de relatórios não existe ou foi desligado. Peça um link novo ao estúdio.
      </p>
    </main>
  );
}
