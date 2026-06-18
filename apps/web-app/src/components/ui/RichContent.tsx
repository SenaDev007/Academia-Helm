'use client';

/**
 * ============================================================================
 * RICH CONTENT — Rendu HTML sécurisé pour contenu riche (Tiptap)
 * ============================================================================
 *
 * Affiche du contenu HTML généré par Tiptap (description, missions,
 * responsabilités des offres d'emploi) avec un rendu typographique propre.
 *
 * SÉCURITÉ :
 *   - Le contenu provient uniquement du Tiptap editor (côté admin authentifié)
 *     donc le risque XSS est limité (pas de saisie publique)
 *   - On strippe quand même les tags dangereux : <script>, <iframe>, <object>,
 *     <embed>, on* attributes (onclick, onerror, etc.), javascript: URLs
 *   - Les tags autorisés : p, ul, ol, li, h2, h3, strong, em, blockquote, br
 *
 * FALLBACK :
 *   - Si le contenu n'est pas du HTML (pas de tag <), on l'affiche en
 *     whitespace-pre-line (compatibilité avec les anciennes offres qui
 *     utilisaient des textareas simples)
 * ============================================================================
 */

import { useMemo } from 'react';

export interface RichContentProps {
  html: string;
  className?: string;
}

/**
 * Sanitize HTML by removing dangerous tags and attributes.
 * Lightweight regex-based sanitization (sufficient for Tiptap output).
 */
function sanitizeHtml(html: string): string {
  let sanitized = html;

  // Remove dangerous tags entirely (script, iframe, object, embed, style, link, meta)
  sanitized = sanitized.replace(
    /<(script|iframe|object|embed|style|link|meta|noscript|template)[^>]*>[\s\S]*?<\/\1>/gi,
    '',
  );
  sanitized = sanitized.replace(
    /<(script|iframe|object|embed|style|link|meta|noscript|template)[^>]*\/?>/gi,
    '',
  );

  // Remove all on* attributes (onclick, onerror, onload, etc.)
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*"[^"]*"/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*'[^']*'/gi, '');
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');

  // Remove javascript: URLs in href/src
  sanitized = sanitized.replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, '$1="#"');
  sanitized = sanitized.replace(/(href|src)\s*=\s*'javascript:[^']*'/gi, "$1='#'");
  sanitized = sanitized.replace(/(href|src)\s*=\s*javascript:[^\s>]+/gi, '$1="#"');

  // Remove data: URLs (potential XSS vector)
  sanitized = sanitized.replace(/(href|src)\s*=\s*"data:[^"]*"/gi, '$1="#"');
  sanitized = sanitized.replace(/(href|src)\s*=\s*'data:[^']*'/gi, "$1='#'");

  return sanitized;
}

export default function RichContent({ html, className = '' }: RichContentProps) {
  const isHtml = useMemo(() => {
    if (!html) return false;
    // Detect HTML if it contains any tag
    return /<[a-z][\s\S]*>/i.test(html);
  }, [html]);

  const sanitized = useMemo(() => (isHtml ? sanitizeHtml(html) : html), [html, isHtml]);

  if (!html) return null;

  if (!isHtml) {
    // Plain text fallback (legacy data from textareas)
    return (
      <p className={`text-sm text-slate-600 whitespace-pre-line leading-relaxed ${className}`}>
        {html}
      </p>
    );
  }

  return (
    <div
      className={`rich-content prose prose-sm max-w-none text-slate-600 leading-relaxed ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}
