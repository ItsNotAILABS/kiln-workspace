#!/usr/bin/env python3
"""Tiny Cloudflare API caller via the connector surrogate (no truncation).
Usage: cf_call.py <METHOD> <path-after-/client/v4> [json-body]"""
import json, sys, urllib.request, urllib.error
sys.path.insert(0, "/opt/muse/skills/custom-connector-setup/bin")
from dynamic_credentials import add_surrogate_to_request

BASE = "https://api.cloudflare.com/client/v4"
method, path = sys.argv[1], sys.argv[2]
body = json.loads(sys.argv[3]) if len(sys.argv) > 3 else None
data = json.dumps(body).encode() if body is not None else None
headers = {"Content-Type": "application/json"} if body is not None else {}
req = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
add_surrogate_to_request(req, "custom.cloudflare", allowed_hosts=["api.cloudflare.com"])
try:
    with urllib.request.urlopen(req, timeout=90) as resp:
        print(resp.status)
        print(resp.read().decode())
except urllib.error.HTTPError as e:
    print(e.code)
    print(e.read().decode())
