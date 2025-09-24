#!/usr/bin/env bash
set -euo pipefail

pushd "$(dirname "$0")/../web" >/dev/null
npm ci
npm run build
popd >/dev/null

rsync -az web/.next/ /var/www/intdata-test/.next/
systemctl restart intdata-test-web
