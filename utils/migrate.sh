#!/usr/bin/env bash
set -Eeuo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
python db/migrate.py "$@"
