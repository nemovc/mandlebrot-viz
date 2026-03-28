#!/usr/bin/env bash
set -e

if ! command -v cargo &> /dev/null; then
    curl https://sh.rustup.rs -sSf | sh -s -- -y
    source "$HOME/.cargo/env"
fi
rustup target add wasm32-unknown-unknown
if ! command -v wasm-pack &> /dev/null; then
    curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh
fi

cd "$(dirname "$0")/../wasm/mandelbrot"
wasm-pack build --target web --out-dir ../../src/lib/wasm --release
