import { CommunitySpace } from '@/components/community/CommunitySpace';

/* ══════════════════════════════════════════════════════════════════════
   ESPACE COMMUNAUTAIRE AUTHENTIFIÉ — /community/space/[slug]
   Route group (community) : layout plein écran dédié (chat), distinct du
   layout public (spacer header). Optional catch-all : /community/space
   ouvre le premier canal.
   ══════════════════════════════════════════════════════════════════════ */

export const dynamic = 'force-dynamic';

export default async function CommunitySpacePage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug } = await params;
  const initialSlug = slug?.[0];
  return <CommunitySpace initialSlug={initialSlug} />;
}
