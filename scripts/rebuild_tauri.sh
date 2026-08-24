#!/bin/bash
# ============================================================================
# Script : rebuild_tauri.sh
# But    : Rebuilder l'app desktop Tauri (Rust) après les changements offline-first
# Usage  : ./rebuild_tauri.sh
# ============================================================================

set -e

echo "🔧 Rebuild Tauri Desktop App — Academia Helm"
echo "============================================"
echo ""

# Vérifier cargo
if ! command -v cargo &> /dev/null; then
  echo "❌ cargo not installed. Install with:"
  echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  exit 1
fi

# Vérifier les dépendances système (Linux)
if [[ "$(uname)" == "Linux" ]]; then
  echo "📋 Vérification des dépendances système Linux..."
  MISSING=""
  for pkg in libgtk-3-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev; do
    if ! dpkg -l | grep -q "^ii.*$pkg "; then
      MISSING="$MISSING $pkg"
    fi
  done
  if [ -n "$MISSING" ]; then
    echo "⚠️  Dépendances système manquantes :$MISSING"
    echo "   Installez-les avec :"
    echo "   sudo apt-get install -y$MISSING"
    echo ""
    echo "   Puis relancez ce script."
    exit 1
  fi
  echo "✅ Dépendances système présentes"
fi

# Aller dans le dossier Tauri
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAURI_DIR="/home/z/my-project/apps/desktop/src-tauri"

if [ ! -d "$TAURI_DIR" ]; then
  echo "❌ Tauri directory not found: $TAURI_DIR"
  exit 1
fi

cd "$TAURI_DIR"

echo ""
echo "📦 Building Tauri (release mode)..."
echo "   This may take 5-10 minutes..."
echo ""

cargo build --release 2>&1 | tail -30

echo ""
echo "✅ Build complete!"
echo ""
echo "🎯 Binary location:"
ls -lh target/release/academia-helm-desktop 2>/dev/null || ls -lh target/release/ | head -10
echo ""
echo "📋 Pour créer un installable (.deb, .AppImage) :"
echo "   cd $TAURI_DIR"
echo "   cargo tauri build"
