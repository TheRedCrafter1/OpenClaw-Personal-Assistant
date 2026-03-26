#!/usr/bin/env bash
set -euo pipefail

WORKSPACE_DIR="${1:-server-etc/workspace/personal-assistant}"

required_files=(
  "SOUL.md"
  "USER.md"
  "IDENTITY.md"
  "AGENTS.md"
  "TOOLS.md"
  "MEMORY.md"
  "BOOTSTRAP.md"
)

if [[ ! -d "$WORKSPACE_DIR" ]]; then
  echo "ERROR: workspace dir not found: $WORKSPACE_DIR" >&2
  exit 1
fi

missing=0
for f in "${required_files[@]}"; do
  if [[ ! -f "$WORKSPACE_DIR/$f" ]]; then
    echo "MISSING: $WORKSPACE_DIR/$f" >&2
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  exit 1
fi

echo "OK: workspace skeleton present: $WORKSPACE_DIR"

