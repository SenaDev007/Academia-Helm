#!/bin/bash
# ============================================================================
# Convertir les fonts Inter TTF → WOFF2 (subset Latin + Latin Extended)
# Réduit ~325 KB par weight → ~80 KB par weight (-75%)
# ============================================================================
set -e

FONT_DIR="/home/z/my-project/apps/web-app/public/fonts/inter"

# Mapping : weight → fichier source TTF (avec nom Google Fonts original)
declare -A WEIGHTS=(
  [400]="UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZg.ttf"
  [500]="UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuI6fMZg.ttf"
  [600]="UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZg.ttf"
  [700]="UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZg.ttf"
)

# Subset : Latin de base + Latin Extended (couvre FR, EN, ES, PT, DE + symboles courants)
# On garde aussi les chiffres, la ponctuation, et quelques symboles mathématiques.
UNICODES="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"

echo "═══════════════════════════════════════════════════════"
echo "  Conversion Inter TTF → WOFF2 (subset Latin)"
echo "═══════════════════════════════════════════════════════"
echo ""

# Créer un sous-dossier pour les TTF originaux (au cas où on voudrait les restaurer)
mkdir -p "$FONT_DIR/_originals-ttf"

total_before=0
total_after=0

for weight in 400 500 600 700; do
  src="${FONT_DIR}/${WEIGHTS[$weight]}"
  dest="${FONT_DIR}/inter-${weight}.woff2"

  if [ ! -f "$src" ]; then
    echo "  ⚠️  $src introuvable — skip"
    continue
  fi

  size_before=$(stat -c %s "$src")
  total_before=$((total_before + size_before))

  echo "  ▶️  Weight $weight:"
  echo "     Source: $(basename "$src") ($((size_before / 1024)) KB)"

  # Conversion en WOFF2 avec subset
  pyftsubset "$src" \
    --unicodes="$UNICODES" \
    --layout-features='*' \
    --output-file="$dest" \
    --flavor=woff2 \
    --no-hinting \
    --desubroutinize \
    --drop-tables+=DSIG \
    2>&1 | grep -v "^$" || true

  if [ -f "$dest" ]; then
    size_after=$(stat -c %s "$dest")
    total_after=$((total_after + size_after))
    ratio=$((100 - (size_after * 100 / size_before)))
    echo "     → inter-${weight}.woff2 ($((size_after / 1024)) KB) [-$ratio%]"
    # Déplacer l'original vers le backup
    mv "$src" "$FONT_DIR/_originals-ttf/"
  else
    echo "     ❌ Échec conversion"
  fi
  echo ""
done

# Supprimer les TTF inutilisés (weights 100, 200, 300, 800, 900)
echo "─── Nettoyage des weights inutilisés ───"
for unused_ttf in "$FONT_DIR"/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuBWYMZg.ttf \
                  "$FONT_DIR"/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuDyYMZg.ttf \
                  "$FONT_DIR"/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuDyfMZg.ttf \
                  "$FONT_DIR"/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyeMZg.ttf \
                  "$FONT_DIR"/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuOKfMZg.ttf; do
  if [ -f "$unused_ttf" ]; then
    size=$(stat -c %s "$unused_ttf")
    echo "  🗑️  $(basename "$unused_ttf") ($((size / 1024)) KB) — déplacé vers _originals-ttf/"
    mv "$unused_ttf" "$FONT_DIR/_originals-ttf/"
  fi
done

# Supprimer font.css (inutilisé — next/font/local génère son propre CSS)
if [ -f "$FONT_DIR/font.css" ]; then
  echo ""
  echo "🗑️  Suppression de font.css (inutilisé — next/font/local génère le sien)"
  mv "$FONT_DIR/font.css" "$FONT_DIR/_originals-ttf/"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  BILAN"
echo "═══════════════════════════════════════════════════════"
echo "  Taille avant : $((total_before / 1024)) KB (4 weights TTF utilisés)"
echo "  Taille après : $((total_after / 1024)) KB (4 weights WOFF2 subset)"
if [ $total_before -gt 0 ]; then
  gain=$((100 - (total_after * 100 / total_before)))
  echo "  Gain         : $gain%"
fi
echo ""
echo "✅ Conversion terminée. Les originaux sont dans :"
echo "   $FONT_DIR/_originals-ttf/"
echo ""
echo "👉 Mettre à jour src/app/layout.tsx pour pointer vers inter-{400,500,600,700}.woff2"
