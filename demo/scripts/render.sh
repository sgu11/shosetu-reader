#!/usr/bin/env bash
# One-shot demo render: ensure prereqs → build once → serve → record → cleanup.
# Uses production build (lighter RAM than `next dev`) to accommodate small machines.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

set -a
# shellcheck disable=SC1091
source demo/.env.demo
set +a

mkdir -p demo/output

APP_PID=""
cleanup() {
  if [[ -n "$APP_PID" ]] && kill -0 "$APP_PID" 2>/dev/null; then
    kill "$APP_PID" 2>/dev/null || true
    wait "$APP_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

echo "==> db:migrate (demo DB)"
pnpm db:migrate

echo "==> seed demo data"
pnpm demo:seed

echo "==> build production bundle"
pnpm build

echo "==> start production server"
pnpm start > demo/output/app.log 2>&1 &
APP_PID=$!

echo "==> wait for app"
for i in $(seq 1 60); do
  if curl -fsS http://localhost:3000/ > /dev/null 2>&1; then
    echo "app is up"
    break
  fi
  if ! kill -0 "$APP_PID" 2>/dev/null; then
    echo "app died — check demo/output/app.log"
    exit 1
  fi
  sleep 1
  if [[ "$i" == "60" ]]; then
    echo "app never came up after 60s"
    exit 1
  fi
done

echo "==> webreel record (auto-downloads chromium + ffmpeg on first run)"
npx webreel record --config demo/webreel.config.json --verbose

# webreel resolves outDir relative to the config file, so segments land in demo/output/
SEGMENT_DIR="demo/output"
FFMPEG="$HOME/.webreel/bin/ffmpeg/ffmpeg"
if [[ ! -x "$FFMPEG" ]]; then
  FFMPEG="ffmpeg"
fi

echo "==> concatenate segments into shosetu-demo.mp4"
CONCAT_LIST="$SEGMENT_DIR/concat.txt"
: > "$CONCAT_LIST"
for seg in 01-home 02-library 03-novel 04-reader-1 05-reader-3 06-outro; do
  if [[ ! -f "$SEGMENT_DIR/$seg.mp4" ]]; then
    echo "missing segment: $seg.mp4" >&2
    exit 1
  fi
  echo "file '$(cd "$SEGMENT_DIR" && pwd)/$seg.mp4'" >> "$CONCAT_LIST"
done

"$FFMPEG" -y -hide_banner -loglevel error \
  -f concat -safe 0 -i "$CONCAT_LIST" -c copy "$SEGMENT_DIR/shosetu-demo.mp4"

echo "==> done"
ls -la "$SEGMENT_DIR/shosetu-demo.mp4"
