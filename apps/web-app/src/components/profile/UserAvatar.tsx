/**
 * ============================================================================
 * USER AVATAR — Avatar partagé (photo de profil ou initiales)
 * ============================================================================
 *
 * Composant d'affichage pur utilisé par TOUS les UI (topbar Pilotage,
 * sidebars portails admin/enseignant/parent, vue promoteur, Federis,
 * boîte de dialogue « Mon profil »).
 *
 * Photo = data URL (users.avatarUrl) servie telle quelle dans <img src>.
 * Fallback = initiales sur fond dégradé bleu Acadia Helm.
 * ============================================================================
 */

'use client';

import { cn } from '@/lib/utils';

interface UserAvatarProps {
  /** Data URL de la photo (users.avatarUrl) — null/undefined → initiales. */
  photoUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  /** Taille du conteneur carré (px). */
  size?: number;
  /** Classes additionnelles (arrondi, ring, ombre…). */
  className?: string;
  /** Classes du bloc initiales (permet d'hériter du thème du portail). */
  initialsClassName?: string;
  /** Alt text personnalisé. */
  alt?: string;
}

export default function UserAvatar({
  photoUrl,
  firstName,
  lastName,
  email,
  size = 36,
  className,
  initialsClassName,
  alt,
}: UserAvatarProps) {
  const initials = `${firstName?.trim()?.[0] ?? ''}${lastName?.trim()?.[0] ?? ''}`.toUpperCase()
    || email?.trim()?.[0]?.toUpperCase()
    || '?';

  const name = alt || `${firstName ?? ''} ${lastName ?? ''}`.trim() || email || 'Utilisateur';

  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- data URL locale, pas d'optimisation nécessaire
      <img
        src={photoUrl}
        alt={name}
        title={name}
        style={{ width: size, height: size }}
        className={cn(
          'rounded-full object-cover flex-shrink-0 bg-slate-100 border border-white/20 shadow-sm',
          className
        )}
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
      className={cn(
        'rounded-full bg-gradient-to-br from-blue-800 to-blue-900 text-white font-semibold flex items-center justify-center flex-shrink-0 select-none',
        initialsClassName,
        className
      )}
      title={name}
    >
      {initials}
    </div>
  );
}
