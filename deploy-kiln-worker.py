#!/usr/bin/env python3
"""Deploy the kiln forge app (.output) to the Cloudflare Worker `kiln`.

Recipe (hard-won, see WORKSPACE_SYSTEM_CHECKPOINT.md completion record):
  1. POST workers/scripts/kiln/assets-upload-session {manifest{path:{hash:md5,size}}}
  2. Upload each bucket base64-multipart (part name=filename=hash);
     the final bucket's 201 carries the completion JWT (0 buckets ->
     the session JWT itself is the assets JWT).
  3. PUT workers/scripts/kiln multipart: metadata JSON + one part per
     server module, Content-Type application/javascript+module (PLUS).
Auth: connector surrogate (custom.cloudflare). The forge daemon token
is read from ~/.kiln-swarm/api.token and sent ONLY as the Worker
secret binding; it is never printed.
"""
import base64, hashlib, json, mimetypes, os, sys, urllib.request, urllib.error
sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request

ACCOUNT = "b313d14c9b479cd98a7206da631a15aa"
SCRIPT = "kiln"
BASE = "https://api.cloudflare.com/client/v4"
ROOT = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(ROOT, ".output", "public")
SRV = os.path.join(ROOT, ".output", "server")
TUNNEL = "https://kiln.medinatechlabs.net"

def req(method, path, data=None, headers=None, auth="surrogate", raw=None):
    url = BASE + path
    body = raw if raw is not None else (json.dumps(data).encode() if data is not None else None)
    h = dict(headers or {})
    if data is not None:
        h["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    if auth == "surrogate":
        add_surrogate_to_request(r, "custom.cloudflare", allowed_hosts=["api.cloudflare.com"])
    elif auth and auth.startswith("jwt:"):
        r.add_header("Authorization", "Bearer " + auth[4:])
    try:
        with urllib.request.urlopen(r, timeout=120) as resp:
            return resp.status, resp.read().decode("utf-8", "replace"), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace"), dict(e.headers or {})

def walk(base):
    out = []
    for dirpath, _dirs, files in os.walk(base):
        for f in files:
            full = os.path.join(dirpath, f)
            rel = os.path.relpath(full, base)
            out.append((rel, full))
    return sorted(out)

def main():
    # ---- assets manifest
    manifest = {}
    blobs = {}
    for rel, full in walk(PUB):
        b = open(full, "rb").read()
        h = hashlib.md5(b).hexdigest()
        manifest["/" + rel.replace(os.sep, "/")] = {"hash": h, "size": len(b)}
        blobs[h] = b
    print(f"assets: {len(manifest)} files")
    st, txt, _ = req("POST", f"/accounts/{ACCOUNT}/workers/scripts/{SCRIPT}/assets-upload-session",
                     data={"manifest": manifest})
    if st not in (200, 201):
        print(f"session FAILED {st}: {txt[:500]}"); sys.exit(1)
    res = json.loads(txt)["result"]
    buckets = res.get("buckets") or []
    jwt = res.get("jwt")
    print(f"session ok: {len(buckets)} buckets")
    # ---- upload buckets
    completion = None
    for i, bucket in enumerate(buckets):
        boundary = "----kilnassets" + hashlib.md5(str(i).encode()).hexdigest()[:12]
        parts = []
        for h in bucket:
            parts.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{h}\"; filename=\"{h}\"\r\nContent-Type: application/octet-stream\r\n\r\n".encode()
                         + base64.b64encode(blobs[h]) + b"\r\n")
        parts.append(f"--{boundary}--\r\n".encode())
        body = b"".join(parts)
        st, txt, hdrs = req("POST", f"/accounts/{ACCOUNT}/workers/assets/upload?base64=true",
                            headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
                            auth="jwt:" + jwt, raw=body)
        if st not in (200, 201, 202):
            print(f"bucket {i} FAILED {st}: {txt[:400]}"); sys.exit(1)
        try:
            j = json.loads(txt)["result"]["jwt"]
            if j:
                completion = j
        except Exception:
            pass
        print(f"bucket {i}: {len(bucket)} files ok (HTTP {st})")
    assets_jwt = completion or jwt
    # ---- server modules
    modules = [(rel, full) for rel, full in walk(SRV) if rel != "wrangler.json"]
    print(f"modules: {len(modules)}")
    token = open(os.path.expanduser("~/.kiln-swarm/api.token")).read().strip()
    metadata = {
        "main_module": "index.mjs",
        "compatibility_date": "2026-10-24",
        "compatibility_flags": ["nodejs_compat"],
        "bindings": [
            {"type": "assets", "name": "ASSETS"},
            {"type": "plain_text", "name": "KILN_SWARM_API_URL", "text": TUNNEL},
            {"type": "secret_text", "name": "KILN_SWARM_TOKEN", "text": token},
        ],
        "assets": {"jwt": assets_jwt},
    }
    boundary = "----kilnscript" + hashlib.md5(b"kiln").hexdigest()[:12]
    body = []
    body.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"metadata\"\r\nContent-Type: application/json\r\n\r\n".encode()
                + json.dumps(metadata).encode() + b"\r\n")
    for rel, full in modules:
        name = rel.replace(os.sep, "/")
        body.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{name}\"; filename=\"{name}\"\r\nContent-Type: application/javascript+module\r\n\r\n".encode()
                    + open(full, "rb").read() + b"\r\n")
    body.append(f"--{boundary}--\r\n".encode())
    st, txt, _ = req("PUT", f"/accounts/{ACCOUNT}/workers/scripts/{SCRIPT}",
                     headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
                     auth="surrogate", raw=b"".join(body))
    print(f"script PUT: {st}")
    if st not in (200, 201):
        print(txt[:800]); sys.exit(1)
    r = json.loads(txt).get("result", {})
    print("deployed:", json.dumps({k: r.get(k) for k in ("id", "etag", "modified_on")}))
    print("OK")

if __name__ == "__main__":
    main()
