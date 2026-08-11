#!/bin/bash
# Build Tauri desktop app with locally extracted webkit2gtk deps
set -e

export PATH="/home/z/tauri-libs/usr/bin:$HOME/.cargo/bin:$PATH"
export PKG_CONFIG_PATH="/home/z/tauri-libs/usr/lib/x86_64-linux-gnu/pkgconfig:/home/z/tauri-libs/usr/share/pkgconfig:${PKG_CONFIG_PATH:-}"
export LD_LIBRARY_PATH="/home/z/tauri-libs/usr/lib/x86_64-linux-gnu:/home/z/tauri-libs/usr/lib:${LD_LIBRARY_PATH:-}"
export LD_RUN_PATH="/home/z/tauri-libs/usr/lib/x86_64-linux-gnu:/home/z/tauri-libs/usr/lib"
export C_INCLUDE_PATH="/home/z/tauri-libs/usr/include:${C_INCLUDE_PATH:-}"
export CPLUS_INCLUDE_PATH="/home/z/tauri-libs/usr/include:${CPLUS_INCLUDE_PATH:-}"

cd /home/z/my-project/apps/desktop

echo "=== Tauri info ==="
npx tauri info 2>&1 | head -15

echo ""
echo "=== Building (release) ==="
# Use --target x86_64-unknown-linux-gnu explicitly
# AppImage + deb are the Linux targets
npx tauri build --target x86_64-unknown-linux-gnu 2>&1 | tail -60

echo ""
echo "=== Build artifacts ==="
find /home/z/my-project/apps/desktop/src-tauri/target/release/bundle -type f 2>&1 | head -20
