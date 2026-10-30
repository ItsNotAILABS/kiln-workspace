#!/usr/bin/env python3
"""Deploy the `kiln` edge worker (kiln.pocketnova.app) via the API.

Flow (see README.md): assets-upload-session -> workers/assets/upload
(base64 multipart per bucket) -> completion token -> POST versions
(NOT deployed) -> caller verifies bindings -> POST deployments.

Worker source: ops-cloudflare/kiln-edge-worker.mjs (kept in sync by hand).
Asset tree: the repo's public/ (194 files). Manifest hashes are the
first 32 hex chars of each file's SHA-256, with its byte size.
Auth: account token via the connector surrogate; upload JWT in memory.
"""
import base64, hashlib, json, mimetypes, os, sys, urllib.request, urllib.error
sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request

BASE = "https://api.cloudflare.com/client/v4"
ACCOUNT = "b313d14c9b479cd98a7206da631a15aa"
SCRIPT = "kiln"
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, "..", "public")

def open_req(req, timeout=180):
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

def api(method, path, body=None, raw=None, ctype=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    headers = {}
    if ctype: headers["Content-Type"] = ctype
    elif body is not None: headers["Content-Type"] = "application/json"
    req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    add_surrogate_to_request(req, "custom.cloudflare", allowed_hosts=["api.cloudflare.com"])
    return open_req(req)

def jwt_post(path, jwt, raw, ctype):
    req = urllib.request.Request(BASE + path, data=raw, headers={"Content-Type": ctype, "Authorization": f"Bearer {jwt}"}, method="POST")
    return open_req(req)

def main():
    worker_src = open(os.path.join(HERE, "kiln-edge-worker.mjs")).read()
    print(f"worker source: {len(worker_src)} chars")
    files = []
    for dirpath, dirnames, filenames in os.walk(ROOT):
        dirnames.sort()
        for fn in sorted(filenames):
            local = os.path.join(dirpath, fn)
            rel = "/" + os.path.relpath(local, ROOT).replace(os.sep, "/")
            content = open(local, "rb").read()
            files.append({"path": rel, "content": content,
                          "hash": hashlib.sha256(content).hexdigest()[:32],
                          "size": len(content),
                          "type": mimetypes.guess_type(local)[0] or "application/octet-stream"})
    manifest = {f["path"]: {"hash": f["hash"], "size": f["size"]} for f in files}
    print(f"manifest: {len(files)} files")

    status, out = api("POST", f"/accounts/{ACCOUNT}/workers/scripts/{SCRIPT}/assets-upload-session", {"manifest": manifest})
    if status != 200:
        raise SystemExit(f"assets-upload-session failed: {status} {out[:400]}")
    sess = json.loads(out)["result"]
    jwt, buckets = sess["jwt"], sess.get("buckets") or []
    print(f"session ok; buckets: {[len(b) for b in buckets]}")
    by_hash = {f["hash"]: f for f in files}
    completion = jwt
    import uuid
    for bucket in buckets:
        boundary = "----cfassets" + uuid.uuid4().hex
        chunks = []
        for h in bucket:
            f = by_hash[h]
            b64 = base64.b64encode(f["content"]).decode()
            chunks.append(f"--{boundary}\r\nContent-Disposition: form-data; name=\"{h}\"\r\nContent-Type: {f['type']}\r\n\r\n{b64}\r\n")
        chunks.append(f"--{boundary}--\r\n")
        status, out = jwt_post(f"/accounts/{ACCOUNT}/workers/assets/upload?base64=true", jwt, "".join(chunks).encode(), f"multipart/form-data; boundary={boundary}")
        if status not in (200, 201, 202):
            raise SystemExit(f"assets upload failed: {status} {out[:400]}")
        res = json.loads(out).get("result") or {}
        if res.get("jwt"): completion = res["jwt"]
        print(f"bucket uploaded: {len(bucket)} files, status {status}")
    print("completion token acquired")

    metadata = {
        "main_module": "index.mjs",
        "compatibility_date": "2026-10-24",
        "compatibility_flags": ["nodejs_compat"],
        "usage_model": "standard",
        "assets": {"jwt": completion},
        "bindings": [
            {"name": "ASSETS", "type": "assets"},
            {"name": "ORIGINAL_API_URL", "type": "plain_text", "text": "https://kiln-original.medinatechlabs.net"},
        ],
        "keep_bindings": ["secret_text"],
    }
    boundary = "----cfversion" + uuid.uuid4().hex
    mp = (
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"metadata\"\r\nContent-Type: application/json\r\n\r\n{json.dumps(metadata)}\r\n"
        f"--{boundary}\r\nContent-Disposition: form-data; name=\"index.mjs\"; filename=\"index.mjs\"\r\nContent-Type: application/javascript+module\r\n\r\n{worker_src}\r\n"
        f"--{boundary}--\r\n"
    ).encode()
    status, out = api("POST", f"/accounts/{ACCOUNT}/workers/scripts/{SCRIPT}/versions", raw=mp, ctype=f"multipart/form-data; boundary={boundary}")
    if status != 200:
        raise SystemExit(f"version create failed: {status} {out[:600]}")
    ver = json.loads(out)["result"]
    print(json.dumps({"version_id": ver.get("id"), "number": ver.get("number")}))

if __name__ == "__main__":
    main()
