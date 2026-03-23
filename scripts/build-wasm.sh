#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/../wasm/mandelbrot"
wasm-pack build --target web --out-dir ../../static/wasm --release
