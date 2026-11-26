"""Capsule assembly. Unique origin per tree. Not the forge origin."""

from __future__ import annotations

import json
import re
from html import escape
from urllib.parse import quote

from .machine import host_of, isolation_of, seal
from .merkle import merkle_of_files

ENTRY_NAMES = ("index.html", "preview.html")


def mime_of(path: str) -> str:
    p = path.lower()
    if p.endswith(".html"):
        return "text/html; charset=utf-8"
    if p.endswith(".css"):
        return "text/css; charset=utf-8"
    if p.endswith(".js") or p.endswith(".mjs"):
        return "text/javascript; charset=utf-8"
    if p.endswith(".json"):
        return "application/json"
    if p.endswith(".svg"):
        return "image/svg+xml"
    if p.endswith(".md"):
        return "text/markdown; charset=utf-8"
    return "text/plain; charset=utf-8"


def data_uri(path: str, body: str) -> str:
    return f"data:{mime_of(path)},{quote(body, safe='')}"


def fallback_html(repo: dict, machine: dict) -> str:
    rid = escape(str(repo.get("id") or ""))
    name = escape(str(repo.get("name") or rid.split("/")[-1]))
    owner = escape(str(repo.get("owner") or rid.split("/")[0]))
    host = escape(machine.get("domain", {}).get("host") or host_of(rid))
    root = escape(str(machine.get("ledger", {}).get("root") or "pending"))
    cwd = escape(str(machine.get("shell", {}).get("cwd") or "/"))
    model = escape(str(machine.get("models", {}).get("label") or "Grok"))
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>{owner}/{name} · kiln capsule</title>
  <style>
    :root{{--bg:#09090b;--fg:#ecece8;--muted:#8e8e89;--seal:#7a9aa8;--line:#2a2a2e}}
    body{{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 "IBM Plex Sans",system-ui;padding:2.5rem}}
    .k{{font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)}}
    h1{{font-family:Newsreader,Georgia,serif;font-size:2.4rem;margin:.4rem 0 0;letter-spacing:-.03em}}
    .row{{display:grid;gap:.6rem;margin-top:1.5rem}}
    .card{{border:1px solid var(--line);border-radius:10px;padding:.9rem 1rem}}
    .seal{{color:var(--seal)}}
  </style>
</head>
<body>
  <p class="k">sealed machine · preview domain</p>
  <h1>{owner}/{name}</h1>
  <p class="seal">kiln://{rid}.git</p>
  <div class="row">
    <div class="card"><strong>Shell</strong><p>kilnsh on this tree. cwd {cwd}.</p></div>
    <div class="card"><strong>Memory</strong><p>Six banks scoped to {rid}.</p></div>
    <div class="card"><strong>Models</strong><p>{model} bound.</p></div>
    <div class="card"><strong>Domain</strong><p>{host}</p></div>
    <div class="card"><strong>Ledger</strong><p>{root}</p></div>
  </div>
</body>
</html>"""


def rewrite_assets(html: str, files: list[dict]) -> str:
    by_path = {}
    by_base = {}
    for f in files:
        path = str(f.get("path") or "")
        body = f.get("content")
        if body is None:
            body = f.get("body") or ""
        if not path or f.get("binary") or not isinstance(body, str) or not body:
            continue
        uri = data_uri(path, body)
        by_path[path] = uri
        by_path[path.lstrip("./")] = uri
        by_base[path.split("/")[-1]] = uri

    def repl(m: re.Match[str]) -> str:
        attr, raw = m.group(1), m.group(2)
        key = raw.replace("./", "").lstrip("/")
        url = by_path.get(key) or by_path.get(raw) or by_base.get(key.split("/")[-1])
        return f'{attr}="{url}"' if url else m.group(0)

    parts = re.split(r"(<script[\s\S]*?</script>)", html, flags=re.I)
    out = []
    for i, part in enumerate(parts):
        if i % 2 == 1:
            out.append(part)
        else:
            out.append(re.sub(r"""(src|href)=["'](?!https?:|data:|blob:|mailto:|#)([^"']+)["']""", repl, part))
    return "".join(out)


def assemble(repo: dict) -> dict:
    repo_id = repo.get("id") or repo.get("repo") or ""
    files = list(repo.get("files") or [])
    machine = seal(repo)
    entry = next((f for f in files if f.get("path") in ENTRY_NAMES and isinstance(f.get("content"), str) and f.get("content")), None)
    html = entry["content"] if entry else fallback_html(repo, machine)
    html = rewrite_assets(html, files)
    kiln_doc = {
        "repo": repo_id,
        "isolation": isolation_of(repo_id),
        "model": machine["models"]["bound"],
        "domain": machine["domain"]["host"],
        "ledger": machine["ledger"]["root"],
        "facets": machine["facets"],
    }
    payload = json.dumps(kiln_doc).replace("<", "\\u003c")
    runtime = (
        f'<script type="application/json" id="kiln-machine">{payload}</script>'
        '<script>window.Kiln=JSON.parse(document.getElementById("kiln-machine").textContent)</script>'
    )
    if re.search(r"<head[^>]*>", html, re.I):
        html = re.sub(r"<head[^>]*>", lambda m: m.group(0) + runtime, html, count=1, flags=re.I)
    else:
        html = runtime + html
    tree = merkle_of_files(files)
    machine["domain"] = {**machine["domain"], "origin": "blob", "status": "live"}
    return {
        "ok": True,
        "repo": repo_id,
        "host": machine["domain"]["host"],
        "isolation": machine["isolation"],
        "merkle": tree["root"],
        "entry": (entry or {}).get("path") or "(fallback)",
        "sandbox": "allow-scripts allow-forms",
        "html": html,
        "machine": machine,
    }
