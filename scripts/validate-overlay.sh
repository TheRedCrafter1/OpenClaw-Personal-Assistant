#!/usr/bin/env bash
set -euo pipefail

OVERLAY_PATH="${1:-server-etc/openclaw/openclaw.overlay.json}"

if [[ ! -f "$OVERLAY_PATH" ]]; then
  echo "ERROR: overlay not found: $OVERLAY_PATH" >&2
  exit 1
fi

if command -v node >/dev/null 2>&1; then
  node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log('OK: valid JSON:', process.argv[1])" "$OVERLAY_PATH"
else
  python3 - <<'PY' "$OVERLAY_PATH"
import json, sys
path=sys.argv[1]
with open(path,'r',encoding='utf-8') as f:
    json.load(f)
print("OK: valid JSON:", path)
PY
fi

