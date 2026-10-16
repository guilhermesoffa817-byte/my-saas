import type { Metadata } from "next";

/*
  Tudo em /contador fica fora do Google, inclusive a página de link errado:
  sem isto, ela herdaria o "pode indexar" do site.
*/
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
  referrer: "no-referrer",
};

export default function LayoutDoContador({ children }: { children: React.ReactNode }) {
  return children;
}
