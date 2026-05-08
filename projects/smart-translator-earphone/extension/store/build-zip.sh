#!/usr/bin/env bash
# Build a Chrome Web Store-ready zip of the extension.
# Usage: ./store/build-zip.sh [output-dir]
# Output: <output-dir>/smart-translator-earphone-v<version>.zip
# Defaults to ./store/dist.

set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="$(node -p "require('./manifest.json').version")"
OUT_DIR="${1:-store/dist}"
ZIP_NAME="smart-translator-earphone-v${VERSION}.zip"

mkdir -p "${OUT_DIR}"
rm -f "${OUT_DIR}/${ZIP_NAME}"

zip -rq "${OUT_DIR}/${ZIP_NAME}" \
  manifest.json \
  background.js \
  offscreen.html \
  offscreen.js \
  popup.html \
  popup.css \
  popup.js \
  README.md \
  icons \
  lib

echo "Built ${OUT_DIR}/${ZIP_NAME}"
unzip -l "${OUT_DIR}/${ZIP_NAME}"
