#!/usr/bin/env bash
# Generate placeholder PNG screenshots / promo tiles for the Chrome
# Web Store listing. ImageMagick required.
# Usage: ./store/generate-placeholders.sh

set -euo pipefail

cd "$(dirname "$0")"
mkdir -p assets

draw () {
  local out="$1"
  local size="$2"
  local title="$3"
  local subtitle="$4"

  convert \
    -size "${size}" \
    "gradient:#0f172a-#1e3a8a" \
    -gravity north \
    -fill "#f8fafc" \
    -font "DejaVu-Sans-Bold" \
    -pointsize 56 \
    -annotate +0+120 "${title}" \
    -fill "#cbd5f5" \
    -font "DejaVu-Sans" \
    -pointsize 32 \
    -annotate +0+220 "${subtitle}" \
    -fill "#22d3ee" \
    -draw "circle 200,$(( ${size##*x} - 200 )) 280,$(( ${size##*x} - 200 ))" \
    -fill "#f97316" \
    -draw "circle $(( ${size%x*} - 200 )),$(( ${size##*x} - 200 )) $(( ${size%x*} - 280 )),$(( ${size##*x} - 200 ))" \
    -fill "#f8fafc" \
    -font "DejaVu-Sans" \
    -pointsize 24 \
    -annotate +0+$(( ${size##*x} - 80 )) "Smart Translator Earphone" \
    "assets/${out}"
  echo "  ${out}"
}

echo "Generating placeholder assets…"
draw screenshot-1.png 1280x800 "Listen in two languages" "Original L · Translation R"
draw screenshot-2.png 1280x800 "Pick a tab, pick two languages" "Free Google Translate built in"
draw screenshot-3.png 1280x800 "Free preset, keyless on web" "STT key only for tab audio"
draw promo-440x280.png 440x280 "Two ears,"  "two languages."
draw marquee-1400x560.png 1400x560 "Live tab translation" "in your right ear."

echo "Done. Replace before submitting to the Chrome Web Store."
