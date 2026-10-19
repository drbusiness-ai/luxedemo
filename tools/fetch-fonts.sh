#!/usr/bin/env bash
# Fetch the self-hosted fonts (Latin subset, woff2) from the Google Fonts CSS2 API.
# Dev-only: run once from the repo root (bash tools/fetch-fonts.sh). The live site never calls Google.
# Output: assets/fonts/*.woff2 (declared in assets/css/fonts.css)
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=assets/fonts
mkdir -p "$OUT"
UA='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36'
API='https://fonts.googleapis.com/css2'

# fetch <query> <style:normal|italic> <outfile>
# Picks the "/* latin */" @font-face block whose font-style matches, downloads its woff2.
fetch() {
  local q="$1" style="$2" file="$3" css url
  css=$(curl -fsS -A "$UA" "$API?$q&display=swap")
  url=$(printf '%s\n' "$css" | awk -v st="$style" '
    /\/\* latin \*\//{inlatin=1; next}
    /\/\*/{inlatin=0}
    inlatin && /font-style:/{ s=$2; gsub(/;/,"",s) }
    inlatin && /src: url\(/{ if (s==st) { match($0,/https:[^)]+/); print substr($0,RSTART,RLENGTH); exit } }')
  if [ -z "$url" ]; then echo "no latin $style face for $q" >&2; exit 1; fi
  curl -fsS -A "$UA" -o "$OUT/$file" "$url"
  printf '%-34s %6s bytes  <- %s\n' "$file" "$(wc -c < "$OUT/$file")" "$q"
}

fetch 'family=Archivo:wdth,wght@62..125,100..900'   normal archivo-var-latin.woff2
fetch 'family=Archivo:wdth,wght@125,500'             normal archivo-expanded-500-latin.woff2
fetch 'family=Instrument+Serif:ital@0;1'             normal instrument-serif-400-latin.woff2
fetch 'family=Instrument+Serif:ital@0;1'             italic instrument-serif-italic-latin.woff2
fetch 'family=IBM+Plex+Mono:wght@400'                normal ibm-plex-mono-400-latin.woff2
fetch 'family=IBM+Plex+Mono:wght@500'                normal ibm-plex-mono-500-latin.woff2
