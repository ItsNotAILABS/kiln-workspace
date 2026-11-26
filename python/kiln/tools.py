#!/usr/bin/env python3
"""JSON tool dispatcher. Stdin: {tool, args}. Stdout: result.

Grok and the crew call these as kiln_* tools during a build.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from .capsule import assemble
from .lock import inspect, load_lock, summary
from .machine import seal
from .merkle import merkle_of_files
from .physics import check_tree
from .repos import find_repo

ROOT = Path(__file__).resolve().parents[2]


def _repo(args: dict) -> dict:
    repo_id = args.get("repo") or args.get("repoId") or "kiln/studio"
    files = args.get("files")
    return find_repo(ROOT, str(repo_id), files)


def kiln_merkle(args: dict) -> dict:
    repo = _repo(args)
    tree = merkle_of_files(repo.get("files") or [])
    tree["ok"] = True
    tree["repo"] = repo.get("id")
    tree["text"] = f"{repo.get('id')} merkle {tree['root']} · {tree['files']} files · {tree['bytes']}B"
    return tree


def kiln_lock(args: dict) -> dict:
    lock = load_lock(ROOT)
    rows = inspect(ROOT, lock)
    out = summary(rows)
    out["spec"] = lock.get("spec")
    out["sourceBranch"] = lock.get("sourceBranch")
    out["text"] = out["text"]
    return out


def kiln_machine(args: dict) -> dict:
    repo = _repo(args)
    machine = seal(repo)
    machine["ok"] = True
    machine["text"] = (
        f"{machine['repoId']}\n"
        f"isolation {machine['isolation']}\n"
        f"cipher {machine['cipher']}\n"
        f"model {machine['models']['bound']}\n"
        f"domain {machine['domain']['host']}\n"
        f"ledger {machine['ledger']['root']}\n"
        f"merkle {machine['ledger']['merkle']}"
    )
    return machine


def kiln_capsule(args: dict) -> dict:
    repo = _repo(args)
    cap = assemble(repo)
    html = cap.pop("html")
    include = bool(args.get("html"))
    cap["ok"] = True
    cap["bytes"] = len(html.encode("utf-8"))
    if include:
        cap["html"] = html
    cap["text"] = (
        f"capsule {cap['repo']} · {cap['host']} · entry {cap['entry']}\n"
        f"isolation {cap['isolation']}\n"
        f"merkle {cap['merkle']}\n"
        f"sandbox {cap['sandbox']}"
    )
    return cap


def kiln_preview(args: dict) -> dict:
    cap = kiln_capsule({**args, "html": False})
    cap["preview"] = f"/{cap['repo']}/preview"
    cap["text"] = cap["text"] + f"\npreview {cap['preview']}"
    return cap


def kiln_physics(args: dict) -> dict:
    repo = _repo(args)
    other_id = args.get("other")
    other = find_repo(ROOT, str(other_id), None) if other_id else None
    out = check_tree(repo, other)
    failed = out.get("failed") or []
    out["text"] = (
        f"physics {out.get('repo')} {'ok' if out.get('ok') else 'FAIL ' + ','.join(failed)}\n"
        f"isolation {out.get('isolation')}\n"
        f"host {out.get('host')}\n"
        f"merkle {out.get('merkle')}\n"
        + "\n".join(f"{x['law']} {'ok' if x.get('ok') else 'FAIL'}" for x in out.get("laws") or [])
    )
    return out


def kiln_infra(args: dict) -> dict:
    model = str(args.get("model") or args.get("name") or "physics").strip()
    inner = {k: v for k, v in args.items() if k not in ("model", "name")}
    return dispatch("kiln_" + model if not model.startswith("kiln_") else model, inner)


DISPATCH = {
    "kiln_merkle": kiln_merkle,
    "kiln_lock": kiln_lock,
    "kiln_machine": kiln_machine,
    "kiln_capsule": kiln_capsule,
    "kiln_preview": kiln_preview,
    "kiln_physics": kiln_physics,
    "kiln_infra": kiln_infra,
}


def dispatch(name: str, args: dict | None = None) -> dict:
    args = args or {}
    fn = DISPATCH.get(name)
    if not fn:
        return {"ok": False, "error": f"unknown infra model {name}", "text": f"unknown infra model {name}"}
    try:
        return fn(args)
    except Exception as e:
        return {"ok": False, "error": str(e), "text": str(e)}


def main() -> int:
    raw = sys.stdin.read()
    if not raw.strip():
        raw = sys.argv[1] if len(sys.argv) > 1 else "{}"
    try:
        req = json.loads(raw)
    except json.JSONDecodeError as e:
        json.dump({"ok": False, "error": f"invalid json: {e}", "text": f"invalid json: {e}"}, sys.stdout)
        return 1
    if isinstance(req, str):
        req = json.loads(req)
    tool = req.get("tool") or req.get("name") or req.get("model") or "kiln_physics"
    args = req.get("args") or req.get("arguments") or req
    if isinstance(args, dict) and args is req:
        args = {k: v for k, v in req.items() if k not in ("tool", "name")}
    out = dispatch(str(tool), args if isinstance(args, dict) else {})
    json.dump(out, sys.stdout)
    sys.stdout.write("\n")
    return 0 if out.get("ok", True) else 2


if __name__ == "__main__":
    raise SystemExit(main())
