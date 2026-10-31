#!/bin/sh
# Enter a per-tree mount namespace. Called inside `unshare --mount`.
# $1 = host tree directory. Remaining args are the program.
set -eu
TREE=$1
shift
if [ ! -d "$TREE" ]; then
  echo "unknown tree" >&2
  exit 127
fi
mkdir -p /run/kiln-ns
mount -t tmpfs -o size=16m,mode=0755,nosuid,nodev tmpfs /run/kiln-ns
mkdir -p /run/kiln-ns/tree
mount --bind "$TREE" /run/kiln-ns/tree
hide() {
  if [ -d "$1" ]; then
    mount -t tmpfs -o size=1m,mode=0755,nosuid,nodev tmpfs "$1" || true
  fi
}
hide /workspace/data
hide /workspace/computers
hide /workspace/scripts
hide /workspace/python
hide /workspace/cas
hide /workspace/pools
hide /workspace/server
hide /workspace/src
hide /workspace/artifacts
hide /workspace/screenshots
hide /workspace/attachments
hide /root
hide /home
mount -t tmpfs -o size=16m,mode=0755,nosuid,nodev tmpfs /tmp || true
cd /run/kiln-ns/tree
export HOME=/run/kiln-ns/tree
export TMPDIR=/tmp
export PYTHONPATH=
export NODE_PATH=
export npm_config_cache=/tmp
unset XAI_API_KEY
unset OPENAI_API_KEY
unset ANTHROPIC_API_KEY
unset GROK_API_KEY
exec "$@"
