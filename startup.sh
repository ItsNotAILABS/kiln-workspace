#!/bin/sh
set -eu
cd /workspace
# Restore Studio / Grok / original HTML from CAS if an overwrite landed.
# Failure must not block the preview; hash-pool --restore is the full undo.
node scripts/kiln-lock.mjs --restore >>/tmp/kiln-lock.log 2>&1 || true
# Python runtime: watchers + workers. Not a public surface.
export PYTHONPATH=/workspace/python
if ! python3 -m kiln.runtime --probe >>/tmp/kiln-backend.log 2>&1; then
  python3 -m kiln.runtime >>/tmp/kiln-backend.log 2>&1 &
fi
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
node scripts/serve-original.mjs >>/tmp/kiln-orig-serve.log 2>&1 &
