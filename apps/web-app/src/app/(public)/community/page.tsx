import { NextResponse } from 'next/server';
import { nestControllerUrl, bffHeaders } from '@/lib/utils/api-urls';
import { fetchWithTimeout } from '@/lib/api/fetch-with-timeout';

/* ══════════════════════════════════════════════════════════════════════
   Page vitrine /community — SSR léger : aperçu public (canaux + stats)
   depuis GET /community/public/overview (aucun compte requis).
   ══════════════════════════════════════════════════════════════════════ */

export const dynamic = 'force-dynamic';

async function getOverview() {
  try {
    const res = await fetchWithTimeout(
      nestControllerUrl('community/public/overview'),
      { headers: bffHeaders() },
      10_000,
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function CommunityLandingPage() {
  const overview = await getOverview();
  const channels = overview?.channels ?? [];
  const stats = overview?.stats ?? { members: 0, clients: 0, messages: 0 };

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b2f73] via-[#0D1F6E] to-[#1d4fa5] text-white">
      {/* ═══ HERO ═══ */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-[12px] font-medium mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-[#f5b335] animate-pulse" />
          La communauté des dirigeants d&apos;établissements scolaires
        </div>
        <h1 className="text-4xl md:text-6xl font-black leading-tight mb-6">
          Academia <span className="text-[#f5b335]">Community</span>
        </h1>
        <p className="text-lg md:text-xl text-blue-100 max-w-2xl mx-auto mb-4">
          Rejoignez l&apos;espace où l&apos;équipe Academia Helm partage chaque jour des conseils
          concrets pour piloter votre école — et où dirigeants et promoteurs s&apos;entraident.
        </p>
        <p className="text-sm text-blue-200 max-w-xl mx-auto mb-10">
          Conseils quotidiens · formations · support direct · sondages · annonces produit.
          Tout se passe <strong className="text-white">dans le produit</strong>, pas sur WhatsApp.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <a
            href="/community/join"
            className="px-8 py-3.5 rounded-xl bg-[#f5b335] text-[#0b2f73] font-bold text-base hover:bg-[#ffd666] transition-colors shadow-xl"
          >
            Rejoindre la communauté — gratuit
          </a>
          <a
            href="/community/login"
            className="px-8 py-3.5 rounded-xl bg-white/10 border border-white/25 font-semibold text-base hover:bg-white/20 transition-colors"
          >
            J&apos;ai déjà un compte
          </a>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto mt-14">
          {[
            { value: stats.members, label: 'membres' },
            { value: stats.messages, label: 'messages échangés' },
            { value: channels.length, label: 'canaux thématiques' },
          ].map((s) => (
            <div key={s.label} className="p-4 rounded-2xl bg-white/5 border border-white/10">
              <p className="text-2xl font-black text-[#f5b335]">{s.value}</p>
              <p className="text-[11px] text-blue-200">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CANAUX ═══ */}
      <section className="bg-white text-slate-800 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-[12px] uppercase tracking-[0.2em] text-[#C07800] font-bold text-center mb-3">
            Espaces thématiques
          </p>
          <h2 className="text-2xl md:text-3xl font-black text-center mb-4">
            Des espaces structurés, pas un groupe de plus
          </h2>
          <p className="text-center text-slate-500 max-w-2xl mx-auto mb-12">
            Chaque canal a un rôle précis. Les conseils quotidiens et annonces de l&apos;équipe
            arrivent en canal dédié — vous ne les perdez jamais au milieu des discussions.
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {((channels.length
              ? channels
              : [
                  { slug: 'annonces', name: 'Annonces & nouveautés', icon: '📢', description: 'Mises à jour du produit, feuilles de route.' },
                  { slug: 'conseils-quotidiens', name: 'Conseils quotidiens', icon: '💡', description: 'Chaque jour, un conseil concret de pilotage.' },
                  { slug: 'discussion-generale', name: 'Discussion générale', icon: '💬', description: 'Entraide entre dirigeants d\u2019établissements.' },
                  { slug: 'formation', name: 'Académie & formations', icon: '🎓', description: 'Guides pratiques et tutoriels vidéo.' },
                  { slug: 'support', name: 'Support produit', icon: '🛠️', description: 'L\u2019équipe et la communauté vous répondent.' },
                  { slug: 'sondages', name: 'Sondages & décisions', icon: '🗳️', description: 'Votre avis oriente la feuille de route.' },
                ]) as { slug: string; name: string; icon: string; description: string; type?: string }[]
            ).map((c) => (
              <div
                key={c.slug}
                className="group p-5 rounded-2xl border border-slate-200 hover:border-[#0b2f73]/30 hover:shadow-lg transition-all bg-white"
              >
                <div className="w-11 h-11 rounded-xl bg-[#0b2f73]/5 flex items-center justify-center text-2xl mb-3">
                  {c.icon}
                </div>
                <h3 className="font-bold text-[15px] mb-1.5">{c.name}</h3>
                <p className="text-[12.5px] text-slate-500 leading-relaxed">{c.description}</p>
                {c.type === 'ANNOUNCEMENT' && (
                  <span className="inline-block mt-3 text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                    Publication équipe · réactions ouvertes
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ POURQUOI ═══ */}
      <section className="bg-[#0D1F6E] py-20">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-3 gap-8">
          {[
            {
              title: 'Grandir chaque jour',
              text: 'Des conseils quotidiens actionnables : finances scolaires, encaissements, pédagogie, communication parents. L\u2019expertise s\u2019accumule — vous n\u2019êtes plus seul face à vos défis.',
            },
            {
              title: 'Un support qui répond',
              text: 'Une question sur le produit ? Le canal support est là. Quand vous avez un souci, vous contactez directement l\u2019équipe — pas un numéro vert anonyme.',
            },
            {
              title: 'Influencer le produit',
              text: 'Sondages réguliers : les fonctionnalités prioritaires sont décidées avec la communauté. Votre retour façonne Academia Helm.',
            },
          ].map((f) => (
            <div key={f.title} className="p-6 rounded-2xl bg-white/5 border border-white/10">
              <h3 className="font-bold text-[#f5b335] text-base mb-2.5">{f.title}</h3>
              <p className="text-[13px] text-blue-100 leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ CTA FINAL ═══ */}
      <section className="bg-gradient-to-b from-[#0D1F6E] to-[#0b2f73] py-16 text-center">
        <h2 className="text-2xl md:text-3xl font-black mb-3">
          Ne ratez plus jamais un conseil
        </h2>
        <p className="text-blue-200 mb-8 text-sm max-w-md mx-auto">
          L&apos;inscription prend 30 secondes. Bienvenue dans le réseau des écoles qui pilotent
          leur croissance.
        </p>
        <a
          href="/community/join"
          className="inline-block px-10 py-4 rounded-xl bg-[#f5b335] text-[#0b2f73] font-bold text-lg hover:bg-[#ffd666] transition-colors shadow-xl"
        >
          Rejoindre Academia Community
        </a>
        <p className="text-[11px] text-blue-300 mt-6">
          Gratuit · aucune carte requise · vos données restent confidentielles
        </p>
      </section>
    </div>
  );
}
