#!/usr/bin/env python3
"""Publish the ORIGIN server (kiln-original, :8931) from the forge.

Companion to publish_from_forge.py (ENTERPRISE-PLAN §6/§7 Phase C): the
origin executes an EXPORT of a forge ref (~/kiln-site/<sha>/, selected
by the ~/kiln-site/current symlink the unit's drop-in points at), never
a working tree. This script is the repeatable form of that cutover:

  1. resolve <ref> (default main) in the daemon's bare repo -> SHA
  2. export the SHA to ~/kiln-site/<sha>/ (skipped if already exported)
  3. carry the runtime data/ over from the CURRENT serving dir
  4. gate: no docker container running (jobs are in-memory; a restart
     forgets them) — abort before touching anything otherwise
  5. flip ~/kiln-site/current -> the new export; restart kiln-original
  6. health-probe :8931 (root 200; public surface answers) — on failure
     flip back, restart, and exit nonzero
  7. receipt: ~/kiln-site/PUBLISHED-ORIGIN.json

Usage: publish_origin_from_forge.py [--ref main] [--bare <path>]
"""
import json, os, shutil, subprocess, sys, tarfile, io, time, urllib.request

HOME = os.path.expanduser("~")
DEFAULT_BARE = os.path.join(HOME, ".kiln-swarm", "git", "auro", "kiln-workspace.git")
SITE_ROOT = os.path.join(HOME, "kiln-site")
DEV_TREE = os.path.join(HOME, "workspace", "repos", "kiln-workspace")


def arg(name, default=None):
    if name in sys.argv:
        i = sys.argv.index(name)
        return sys.argv[i + 1] if i + 1 < len(sys.argv) else default
    return default


def http_get(url, token=None, timeout=20):
    req = urllib.request.Request(url)
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.status, resp.read()


def main():
    ref = arg("--ref", "main")
    bare = arg("--bare", DEFAULT_BARE)
    sha = subprocess.run(["git", f"--git-dir={bare}", "rev-parse", ref],
                         capture_output=True, text=True, check=True).stdout.strip()
    print(f"forge {ref} = {sha}")
    dest = os.path.join(SITE_ROOT, sha)
    current = os.path.join(SITE_ROOT, "current")
    previous = os.path.realpath(current) if os.path.islink(current) else None

    if not os.path.exists(os.path.join(dest, ".export-complete")):
        os.makedirs(dest, exist_ok=True)
        raw = subprocess.run(["git", f"--git-dir={bare}", "archive", sha],
                             capture_output=True, check=True).stdout
        with tarfile.open(fileobj=io.BytesIO(raw)) as tar:
            tar.extractall(dest)
        # runtime state carries forward from wherever the server runs now
        src_data = None
        for cand in (os.path.join(previous, "data") if previous else None,
                     os.path.join(DEV_TREE, "data")):
            if cand and os.path.isdir(cand):
                src_data = cand
                break
        if src_data:
            shutil.copytree(src_data, os.path.join(dest, "data"))
            print(f"data/: carried from {src_data}")
        with open(os.path.join(dest, ".export-complete"), "w") as f:
            f.write(sha + "\n")
        print(f"export: {sha} -> {dest}")
    else:
        print(f"export: reusing {dest}")

    if previous == dest:
        print("origin already serves this SHA — nothing to do")
        return

    # restart gate: no docker container may be running
    token = open(os.path.join(HOME, ".kiln-swarm", "api.token")).read().strip()
    _, body = http_get("http://127.0.0.1:8931/api/kiln/docker/status", token=token)
    running = json.loads(body)["engine"]["containersRunning"]
    if running:
        raise SystemExit(f"ABORT: {running} docker container(s) running — restart gate closed")
    print("restart gate: 0 containers running")

    def flip(target):
        tmp = current + ".tmp"
        if os.path.islink(tmp) or os.path.exists(tmp):
            os.unlink(tmp)
        os.symlink(target, tmp)
        os.rename(tmp, current)

    flip(dest)
    subprocess.run(["systemctl", "restart", "kiln-original"], check=True)
    print(f"flipped current -> {dest}; kiln-original restarted")

    ok = False
    for _ in range(12):
        time.sleep(3)
        try:
            status, _ = http_get("http://127.0.0.1:8931/", timeout=10)
            if status == 200:
                ok = True
                break
        except Exception:
            pass
    if not ok:
        print("HEALTH PROBE FAILED — rolling back")
        if previous:
            flip(previous)
            subprocess.run(["systemctl", "restart", "kiln-original"], check=True)
        raise SystemExit("origin publish failed and was rolled back")

    receipt = {"published_sha": sha, "ref": ref, "previous": previous,
               "export": dest, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}
    with open(os.path.join(SITE_ROOT, "PUBLISHED-ORIGIN.json"), "w") as f:
        json.dump(receipt, f, indent=2)
    print("receipt:", json.dumps(receipt))


if __name__ == "__main__":
    main()
