#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="personal-assistant.service"
SRC_PATH="server-etc/systemd/${SERVICE_NAME}"
DST_PATH="/etc/systemd/system/${SERVICE_NAME}"

if [[ ! -f "$SRC_PATH" ]]; then
  echo "ERROR: missing service file at $SRC_PATH" >&2
  exit 1
fi

sudo cp "$SRC_PATH" "$DST_PATH"
sudo systemctl daemon-reload
sudo systemctl enable "${SERVICE_NAME}"
sudo systemctl restart "${SERVICE_NAME}"
sudo systemctl status "${SERVICE_NAME}" --no-pager

