/**
 * A caixa que aparece quando o horário esbarra em outro.
 *
 * Encaixe é coisa normal de estúdio: a cliente que faz só a sobrancelha
 * enquanto a outra espera a tinta secar. Por isso o conflito não é um "não":
 * a tela avisa, e quem conhece a própria rotina decide marcar mesmo assim.
 */
export function CaixaDeEncaixe({ id }: { id: string }) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-areia-escura bg-areia/40 px-4 py-3"
    >
      <input
        id={id}
        type="checkbox"
        name="encaixe"
        value="sim"
        className="mt-0.5 h-5 w-5 shrink-0 accent-terracota"
      />
      <span className="min-w-0 text-sm leading-relaxed text-carvao">
        <span className="font-semibold">Marcar mesmo assim (encaixe)</span>
        <span className="block text-xs text-carvao-suave">
          Os dois horários ficam na agenda, um em cima do outro.
        </span>
      </span>
    </label>
  );
}
