/* Layout dédié à l'espace communautaire authentifié — plein écran, sans
   header public ni spacer : l'interface chat gère sa propre top bar. */
export const metadata = {
  title: 'Academia Community — Espace membres',
  robots: { index: false, follow: false },
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <div className="bg-slate-50">{children}</div>;
}
