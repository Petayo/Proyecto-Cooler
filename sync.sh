#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_HOST="${RSYNC_HOST:-ubuntu@192.168.1.153}"
REMOTE_DIR="${RSYNC_DIR:-~/smart-cooler}"
RSYNC_PASS="${RSYNC_PASS:-rubikpi}"

sshpass -p "$RSYNC_PASS" rsync -avz --delete \
  --exclude-from="${SCRIPT_DIR}/.rsyncignore" \
  "${SCRIPT_DIR}/backend/" \
  "${REMOTE_HOST}:${REMOTE_DIR}/"