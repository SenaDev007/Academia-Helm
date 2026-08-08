#!/bin/bash
# ============================================================================
# Tauri Windows Cross-Compilation Build Script
# ============================================================================
# Builds the Academia Helm desktop app for Windows (.exe + NSIS installer)
# from a Linux host using cargo-xwin + clang-cl + lld-link.
#
# Prerequisites (already installed in this environment):
#   - Rust stable + x86_64-pc-windows-msvc target
#   - cargo-xwin (cargo install cargo-xwin)
#   - LLVM/Clang 19 at /home/z/my-project/.clang/
#   - NSIS 3.11 at /home/z/my-project/.nsis/
#   - Tauri CLI (npm install -g @tauri-apps/cli)
#
# Usage:
#   ./scripts/build-tauri-windows.sh          # Full build + installer
#   ./scripts/build-tauri-windows.sh --check  # Just verify compilation
# ============================================================================

set -e

# ── Environment Setup ──────────────────────────────────────────────────────

export PATH="/home/z/my-project/.nsis/usr/bin:/home/z/my-project/.clang/usr/lib/llvm-19/bin:$HOME/.cargo/bin:$PATH"
export LD_LIBRARY_PATH="/home/z/my-project/.clang/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH"
export NSISDIR="/home/z/my-project/.nsis/usr/share/nsis"

# C/C++ compiler for cross-compilation (clang-cl = MSVC-compatible clang)
export CC_x86_64_pc_windows_msvc="clang-cl"
export CXX_x86_64_pc_windows_msvc="clang-cl"
export AR_x86_64_pc_windows_msvc="llvm-lib"

# Include paths: MSVC SDK (via xwin) + clang built-in headers
CLANG_INCLUDE="/home/z/my-project/.clang/usr/lib/llvm-19/lib/clang/19/include"
XWIN_SDK="/home/z/.cache/cargo-xwin/xwin"
export CFLAGS_x86_64_pc_windows_msvc="--target=x86_64-pc-windows-msvc -Wno-unused-command-line-argument -fuse-ld=lld-link /imsvc $XWIN_SDK/crt/include /imsvc $XWIN_SDK/sdk/include/ucrt /imsvc $XWIN_SDK/sdk/include/um /imsvc $XWIN_SDK/sdk/include/shared /imsvc $XWIN_SDK/sdk/include/winrt /imsvc $CLANG_INCLUDE"

# ── Build ─────────────────────────────────────────────────────────────────

cd /home/z/my-project/apps/desktop/src-tauri

if [ "$1" = "--check" ]; then
    echo "==> Checking Rust compilation for Windows..."
    cargo xwin check --release --target x86_64-pc-windows-msvc
    echo "✓ Code compiles successfully for Windows"
    exit 0
fi

echo "==> Building Windows .exe binary..."
cargo xwin build --release --target x86_64-pc-windows-msvc

EXE_PATH="target/x86_64-pc-windows-msvc/release/academia-helm-desktop.exe"
echo "✓ Built: $EXE_PATH ($(du -h "$EXE_PATH" | cut -f1))"

echo ""
echo "==> Creating NSIS installer..."
# Use tauri CLI to generate the NSIS script, then run makensis directly
# (tauri's bundler has issues finding makensis on Linux)
cd /home/z/my-project/apps/desktop
tauri build --target x86_64-pc-windows-msvc --bundles nsis 2>&1 | tail -5 || true

# If tauri's bundler failed, run makensis manually
NSI_SCRIPT="src-tauri/target/x86_64-pc-windows-msvc/release/nsis/x64/installer.nsi"
if [ -f "$NSI_SCRIPT" ]; then
    echo "==> Running makensis manually..."
    cd "src-tauri/target/x86_64-pc-windows-msvc/release/nsis/x64/"
    makensis installer.nsi
    cd -

    INSTALLER="src-tauri/target/x86_64-pc-windows-msvc/release/nsis/x64/nsis-output.exe"
    if [ -f "$INSTALLER" ]; then
        VERSION=$(grep '"version"' src-tauri/tauri.conf.json | sed 's/.*: *"\([^"]*\)".*/\1/')
        cp "$INSTALLER" "/home/z/my-project/download/Academia-Helm-v${VERSION}-windows-setup.exe"
        echo "✓ Installer: /home/z/my-project/download/Academia-Helm-v${VERSION}-windows-setup.exe"
    fi
fi

# Also copy the portable .exe
cp "$EXE_PATH" "/home/z/my-project/download/academia-helm-desktop-v$(grep '"version"' src-tauri/tauri.conf.json | sed 's/.*: *"\([^"]*\)".*/\1/').exe"
echo "✓ Portable: /home/z/my-project/download/academia-helm-desktop-v*.exe"

echo ""
echo "=== Build Complete ==="
echo "Files in /home/z/my-project/download/:"
ls -lh /home/z/my-project/download/academia-helm* /home/z/my-project/download/Academia-Helm* 2>/dev/null
