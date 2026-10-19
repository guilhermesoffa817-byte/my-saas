import { canaisDeContato } from "@/lib/contato";

/**
 * Os canais de contato como links ("e-mail · WhatsApp"). Não desenha nada
 * quando nenhum canal foi preenchido no servidor: quem usa decide o que dizer
 * no lugar, com `canaisDeContato().length`.
 */
export function LinksDeContato({ className }: { className?: string }) {
  const canais = canaisDeContato();
  if (!canais.length) return null;
  return (
    <span className={className}>
      {canais.map((canal, i) => (
        <span key={canal.tipo}>
          {i > 0 && " · "}
          <a
            href={canal.href}
            className="font-medium text-terracota underline-offset-2 hover:underline"
            {...(canal.tipo === "whatsapp" ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            {canal.tipo === "whatsapp" ? `WhatsApp ${canal.rotulo}` : canal.rotulo}
          </a>
        </span>
      ))}
    </span>
  );
}
