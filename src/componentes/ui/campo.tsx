/**
 * Campos de formulário. Todos com rótulo visível, dica opcional embaixo e a
 * mesma altura de toque, porque quem usa o Bossa preenche isso com o polegar,
 * de pé, entre um atendimento e outro.
 */

type Comuns = {
  nome: string;
  rotulo: string;
  dica?: string;
  obrigatorio?: boolean;
  /**
   * Quando o mesmo campo aparece várias vezes na página, numa lista, o nome
   * precisa continuar igual para o formulário, mas o id tem de ser único para
   * o rótulo apontar para o campo certo.
   */
  idDoCampo?: string;
};

function Envolver({
  nome,
  rotulo,
  dica,
  obrigatorio,
  idDoCampo,
  children,
}: Comuns & { children: React.ReactNode }) {
  const id = idDoCampo ?? nome;
  return (
    <div>
      <label className="rotulo" htmlFor={id}>
        {rotulo}
        {obrigatorio ? null : <span className="font-normal"> (opcional)</span>}
      </label>
      {children}
      {dica ? (
        <p id={`${id}-dica`} className="mt-1.5 text-xs leading-relaxed text-carvao-suave">
          {dica}
        </p>
      ) : null}
    </div>
  );
}

export function Campo({
  nome,
  rotulo,
  dica,
  obrigatorio = true,
  tipo = "text",
  idDoCampo,
  ...resto
}: Comuns &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "id" | "type"> & {
    tipo?: string;
  }) {
  const id = idDoCampo ?? nome;
  return (
    <Envolver nome={nome} rotulo={rotulo} dica={dica} obrigatorio={obrigatorio} idDoCampo={id}>
      <input
        id={id}
        name={nome}
        type={tipo}
        required={obrigatorio}
        aria-describedby={dica ? `${id}-dica` : undefined}
        className="campo"
        {...resto}
      />
    </Envolver>
  );
}

export function Area({
  nome,
  rotulo,
  dica,
  obrigatorio = false,
  ...resto
}: Comuns & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "id">) {
  return (
    <Envolver nome={nome} rotulo={rotulo} dica={dica} obrigatorio={obrigatorio}>
      <textarea
        id={nome}
        name={nome}
        required={obrigatorio}
        rows={4}
        aria-describedby={dica ? `${nome}-dica` : undefined}
        className="campo"
        {...resto}
      />
    </Envolver>
  );
}

export function Escolha({
  nome,
  rotulo,
  dica,
  obrigatorio = true,
  opcoes,
  ...resto
}: Comuns &
  Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name" | "id"> & {
    opcoes: { valor: string; rotulo: string }[];
  }) {
  return (
    <Envolver nome={nome} rotulo={rotulo} dica={dica} obrigatorio={obrigatorio}>
      <select
        id={nome}
        name={nome}
        required={obrigatorio}
        aria-describedby={dica ? `${nome}-dica` : undefined}
        className="campo"
        {...resto}
      >
        {opcoes.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>
    </Envolver>
  );
}

/**
 * Escolha entre poucas opções, em botões lado a lado. Melhor que uma lista
 * suspensa no celular: a pessoa vê tudo de uma vez e acerta de primeira.
 */
export function Botoes({
  nome,
  rotulo,
  dica,
  opcoes,
  valorPadrao,
}: Comuns & {
  opcoes: { valor: string; rotulo: string }[];
  valorPadrao?: string;
}) {
  return (
    <fieldset>
      <legend className="rotulo">{rotulo}</legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((opcao) => (
          <label
            key={opcao.valor}
            className="cursor-pointer rounded-xl border border-areia-escura bg-superficie px-4 py-2.5 text-sm font-semibold text-carvao-suave transition has-[:checked]:border-terracota has-[:checked]:bg-terracota has-[:checked]:text-acento-texto"
          >
            <input
              type="radio"
              name={nome}
              value={opcao.valor}
              defaultChecked={valorPadrao === opcao.valor}
              className="sr-only"
            />
            {opcao.rotulo}
          </label>
        ))}
      </div>
      {dica ? (
        <p className="mt-1.5 text-xs leading-relaxed text-carvao-suave">{dica}</p>
      ) : null}
    </fieldset>
  );
}
