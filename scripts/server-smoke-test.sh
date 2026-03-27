#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:3000}"

echo "Checking ${BASE_URL}/health"
curl -fsS "${BASE_URL}/health"
echo

echo "Checking ${BASE_URL}/"
curl -fsS "${BASE_URL}/"
echo

echo "OK: smoke test passed"

