#!/bin/bash
# Tauri Windows cross-compilation build script
# Sets up environment for building Windows .exe/.msi on Linux

set -e

export PATH="/home/z/my-project/.clang/usr/lib/llvm-19/bin:$HOME/.cargo/bin:$PATH"
export LD_LIBRARY_PATH="/home/z/my-project/.clang/usr/lib/x86_64-linux-gnu:$LD_LIBRARY_PATH"

# Tell cc-rs to use clang-cl for C/C++ compilation
export CC_x86_64_pc_windows_msvc="clang-cl"
export CXX_x86_64_pc_windows_msvc="clang-cl"
export AR_x86_64_pc_windows_msvc="llvm-lib"

# Add clang's built-in include directory (for stdalign.h, stdbool.h, etc.)
CLANG_INCLUDE="/home/z/my-project/.clang/usr/lib/llvm-19/lib/clang/19/include"
export CFLAGS_x86_64_pc_windows_msvc="--target=x86_64-pc-windows-msvc -Wno-unused-command-line-argument -fuse-ld=lld-link /imsvc /home/z/.cache/cargo-xwin/xwin/crt/include /imsvc /home/z/.cache/cargo-xwin/xwin/sdk/include/ucrt /imsvc /home/z/.cache/cargo-xwin/xwin/sdk/include/um /imsvc /home/z/.cache/cargo-xwin/xwin/sdk/include/shared /imsvc /home/z/.cache/cargo-xwin/xwin/sdk/include/winrt /imsvc $CLANG_INCLUDE"

cd /home/z/my-project/apps/desktop/src-tauri

# Run the build
cargo xwin build --release --target x86_64-pc-windows-msvc "$@"
