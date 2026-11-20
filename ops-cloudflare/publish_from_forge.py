#!/usr/bin/env python3
"""Publish kiln.pocketnova.app FROM THE FORGE — never from a working tree.

The GitHub-class shape (ENTERPRISE-PLAN §6/§7 Phase A): the hosted repo
is the only truth, so publishing materializes an export of a forge ref
straight from the daemon's bare repo and deploys THAT. No working tree
(dev checkout, deploy tree, lane worktree) is read at any point, so a
dirty or diverged tree cannot affect the site — divergence is not
forbidden, it is unrepresentable in this path.

Flow:
  1. resolve <ref> (default: main) in the bare repo -> SHA
  2. `git archive` the SHA into ~/workspace/.publish/kiln-workspace/<sha>/
     (skipped if a complete export already exists)
  3. run the EXPORT's own ops-cloudflare/deploy_worker.py (it ships the
     export's public/ + the export's kiln-edge-worker.mjs)
  4. verify the created version's bindings: ASSETS + ORIGINAL_API_URL +
     KILN_SWARM_TOKEN as secret_text (preserved via keep_bindings) —
     promotion does not happen if the bindings differ
  5. promote the version to 100%
  6. write a receipt (PUBLISHED.json next to the export + --receipt path)

Usage:
  publish_from_forge.py [--ref main] [--bare ~/.kiln-swarm/git/auro/kiln-workspace.git]
                        [--receipt <path>] [--no-promote]
"""
import json, os, subprocess, sys, tarfile, io, urllib.request, urllib.error
sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request

BASE = "https://api.cloudflare.com/client/v4"
ACCOUNT = "b313d14c9b479cd98a7206da631a15aa"
SCRIPT = "kiln"
HOME = os.path.expanduser("~")
DEFAULT_BARE = os.path.join(HOME, ".kiln-swarm", "git", "auro", "kiln-workspace.git")
EXPORT_ROOT = os.path.join(HOME, "workspace", ".publish", "kiln-workspace")


def arg(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        return sys.argv[i + 1] if i + 1 < len(sys.argv) else default
    return default


def api(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"} if body is not None else {}
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    add_surrogate_to_request(req, "custom.cloudflare", allowed_hosts=["api.cloudflare.com"])
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def export_ref(bare, sha):
    dest = os.path.join(EXPORT_ROOT, sha)
    marker = os.path.join(dest, ".export-complete")
    if os.path.exists(marker):
        print(f"export: reusing {dest}")
        return dest
    os.makedirs(dest, exist_ok=True)
    raw = subprocess.run(["git", f"--git-dir={bare}", "archive", sha],
                         capture_output=True, check=True).stdout
    with tarfile.open(fileobj=io.BytesIO(raw)) as tar:
        tar.extractall(dest)
    with open(marker, "w") as f:
        f.write(sha + "\n")
    print(f"export: {sha} -> {dest}")
    return dest


def main():
    ref = arg("--ref", "main")
    bare = arg("--bare", DEFAULT_BARE)
    receipt_path = arg("--receipt")
    promote = "--no-promote" not in sys.argv

    sha = subprocess.run(["git", f"--git-dir={bare}", "rev-parse", ref],
                         capture_output=True, text=True, check=True).stdout.strip()
    print(f"forge {ref} = {sha}")
    export_dir = export_ref(bare, sha)

    deploy = os.path.join(export_dir, "ops-cloudflare", "deploy_worker.py")
    if not os.path.exists(deploy):
        raise SystemExit(f"export has no deploy_worker.py at {deploy}")
    out = subprocess.run([sys.executable, deploy], capture_output=True, text=True)
    sys.stdout.write(out.stdout)
    if out.returncode != 0:
        sys.stderr.write(out.stderr)
        raise SystemExit("deploy_worker.py failed — nothing promoted")
    ver = None
    for line in out.stdout.splitlines():
        line = line.strip()
        if line.startswith('{"version_id"'):
            ver = json.loads(line)
    if not ver:
        raise SystemExit("no version_id in deploy output — nothing promoted")
    version_id, number = ver["version_id"], ver["number"]
    print(f"version: v{number} ({version_id})")

    status, doc = api("GET", f"/accounts/{ACCOUNT}/workers/scripts/{SCRIPT}/versions/{version_id}")
    if status != 200:
        raise SystemExit(f"bindings check failed: HTTP {status} — nothing promoted")
    bindings = {
        b["name"]: b["type"]
        for b in doc.get("result", {}).get("resources", {}).get("bindings", [])
    }
    expected = {"ASSETS": "assets", "KILN_SWARM_TOKEN": "secret_text", "ORIGINAL_API_URL": "plain_text"}
    if bindings != expected:
        raise SystemExit(f"bindings differ: got {bindings}, expected {expected} — NOT promoting")
    print(f"bindings verified: {bindings}")

    if promote:
        status, doc = api("POST", f"/accounts/{ACCOUNT}/workers/scripts/{SCRIPT}/deployments",
                          {"strategy": "percentage",
                           "versions": [{"version_id": version_id, "percentage": 100}]})
        if status != 200:
            raise SystemExit(f"promotion failed: HTTP {status} {str(doc)[:300]}")
        print(f"promoted: v{number} at 100%")
    else:
        print("promotion skipped (--no-promote)")

    receipt = {"published_sha": sha, "ref": ref, "worker_version": number,
               "version_id": version_id, "promoted": promote,
               "export": export_dir}
    with open(os.path.join(export_dir, "PUBLISHED.json"), "w") as f:
        json.dump(receipt, f, indent=2)
    if receipt_path:
        with open(receipt_path, "w") as f:
            json.dump(receipt, f, indent=2)
    print("receipt:", json.dumps(receipt))


if __name__ == "__main__":
    main()
