"use client";

/**
 * ============================================================================
 * LINK EMBED — Aperçu de liens façon Discord (V4 Phase 2)
 * ============================================================================
 *
 * ⭐ Porté de « Yeshua Connect » (LinkEmbed.tsx) :
 *   - extrait les URLs d'un texte (regex) ;
 *   - pour la première URL, interroge /api/og?url= (BFF Next.js) qui
 *     renvoie les métadonnées OpenGraph (og:title, og:description,
 *     og:image) ;
 *   - rend une carte cliquable avec miniature — fallback sobre domaine
 *     seul si l'aperçu échoue ( SSRF-safe, timeout court, cache local).
 * ============================================================================
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Extrait les URLs http(s) d'un texte (même regex que Yeshua Connect). */
export function extractUrls(text: string): string[] {
  const regex = /https?:\/\/[^\s<>"')\]]+/gi;
  return (text.match(regex) || []) as string[];
}

interface OgMeta {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export function LinkEmbed({ text }: { text: string }) {
  const urls = useMemo(() => extractUrls(text || ''), [text]);
  const [meta, setMeta] = useState<OgMeta | null>(null);
  const [loading, setLoading] = useState(false);

  const firstUrl = urls[0];

  useEffect(() => {
    if (!firstUrl) return;
    let cancelled = false;
    setLoading(true);
    // Cache de session léger (une URL n'est résolue qu'une fois par onglet)
    const cacheKey = `helm-og:${firstUrl}`;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setMeta(JSON.parse(cached));
        setLoading(false);
        return;
      }
    } catch {}
    fetch(`/api/og?url=${encodeURIComponent(firstUrl)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: OgMeta | null) => {
        if (cancelled) return;
        if (data?.title || data?.image) {
          setMeta({ ...data, url: firstUrl });
          try { sessionStorage.setItem(cacheKey, JSON.stringify({ ...data, url: firstUrl })); } catch {}
        } else {
          setMeta({ url: firstUrl });
        }
      })
      .catch(() => { if (!cancelled) setMeta({ url: firstUrl }); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [firstUrl]);

  if (!firstUrl) return null;

  // Domaine seul (fallback sobre)
  let domain = firstUrl;
  try { domain = new URL(firstUrl).hostname.replace(/^www\./, ''); } catch {}

  if (loading) {
    return (
      <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-400">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Chargement de l'aperçu…</span>
      </div>
    );
  }

  return (
    <a
      href={firstUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'mt-1.5 flex gap-2 rounded-lg overflow-hidden border max-w-[280px] group',
        'bg-black/[0.03] hover:bg-black/[0.06] border-black/10',
        meta?.title ? 'p-2' : 'px-2 py-1.5 items-center',
      )}
    >
      {meta?.image ? (
        <img
          src={meta.image}
          alt={meta.title || domain}
          className="w-16 h-16 rounded-md object-cover flex-shrink-0 bg-slate-100"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      ) : !meta?.title ? (
        <Link2 className="w-3.5 h-3.5 flex-shrink-0 text-slate-400" />
      ) : null}
      <div className="min-w-0 flex-1">
        {meta?.title && (
          <div className="text-xs font-semibold text-slate-800 line-clamp-2 group-hover:underline">{meta.title}</div>
        )}
        {meta?.description && (
          <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{meta.description}</div>
        )}
        <div className="text-[10px] text-slate-400 truncate mt-0.5">{meta?.siteName || domain}</div>
      </div>
    </a>
  );
}

export default LinkEmbed;
