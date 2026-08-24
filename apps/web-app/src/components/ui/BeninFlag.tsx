/**
 * ⭐ Drapeau du Bénin — SVG inline (pas d'image externe)
 *    Utilisé pour le cérémonial des couleurs dans l'emploi du temps.
 *    Composition : bande verte à gauche (1/3), jaune en haut à droite (2/3),
 *    rouge en bas à droite (2/3).
 */
export function BeninFlag({ className = '', size = 16 }: { className?: string; size?: number }) {
  const ratio = 1.5; // width:height = 3:2
  const width = size * ratio;
  const height = size;
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 30 20"
      className={className}
      style={{ borderRadius: 2, flexShrink: 0 }}
      aria-label="Drapeau du Bénin"
    >
      <rect x="0" y="0" width="10" height="20" fill="#008751" />
      <rect x="10" y="0" width="20" height="10" fill="#FCD116" />
      <rect x="10" y="10" width="20" height="10" fill="#E8112D" />
    </svg>
  );
}
