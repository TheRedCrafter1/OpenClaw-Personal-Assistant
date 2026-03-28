#!/usr/bin/env bash
# Optional post-write hook for MEMORY_SYNC_COMMAND (OpenClaw / git / CI).
# Default: no-op. Enable your workflow here, e.g. lobster, git push, or rsync.
set -euo pipefail
: "${MEMORY_SYNC_VERBOSE:=}"
if [[ -n "${MEMORY_SYNC_VERBOSE}" ]]; then
  echo "sync-memory.sh: noop (set MEMORY_SYNC_VERBOSE=1 to see this; edit script for real sync)."
fi
exit 0
