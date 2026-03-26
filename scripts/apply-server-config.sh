#!/usr/bin/env bash
set -euo pipefail

# Safe-by-default config sync helper.
# - DRY RUN by default
# - No secrets
# - You choose the target directory explicitly

DRY_RUN="${DRY_RUN:-1}"
SRC_DIR="${SRC_DIR:-server-etc}"
TARGET_DIR="${1:-}"

if [[ -z "$TARGET_DIR" ]]; then
  echo "Usage: $0 <target-dir>" >&2
  echo "Example (dry-run): DRY_RUN=1 $0 /root/openclaw-taximeister/server-etc" >&2
  echo "Example (apply):   DRY_RUN=0 $0 /root/openclaw-taximeister/server-etc" >&2
  exit 2
fi

if [[ ! -d "$SRC_DIR" ]]; then
  echo "ERROR: source dir not found: $SRC_DIR" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"

RSYNC_ARGS=(-a --delete)
if [[ "$DRY_RUN" == "1" ]]; then
  RSYNC_ARGS+=(--dry-run)
fi

echo "Syncing '$SRC_DIR/' -> '$TARGET_DIR/' (DRY_RUN=$DRY_RUN)"
rsync "${RSYNC_ARGS[@]}" "$SRC_DIR/" "$TARGET_DIR/"
echo "OK"

