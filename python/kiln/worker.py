"""Backend workers. Reconcile, census, lock, gc, merkle, vaults, sessions, mind."""

from __future__ import annotations

import json
import time
from pathlib import Path

from .base import job_base_census, job_base_hooks, job_base_index, job_wallet_audit
from .health import probe
from .lock import inspect, load_lock, summary
from .merkle import merkle_of_files
from .paths import ACCOUNTS, BADGE_DIR, BADGES, BASE, CACHE, COMPUTERS, ORGANISM, ROOT, SESSIONS, USERS, VAULTS
from .store import read, write


def run(job: dict) -> dict:
    kind = job.get("kind") or ""
    payload = job.get("payload") or {}
    fn = HANDLERS.get(kind)
    if not fn:
        return {"ok": False, "error": f"unknown job {kind}"}
    return fn(payload)


def job_heartbeat(_payload: dict) -> dict:
    p = probe()
    return {"ok": True, **{k: v for k, v in p.items() if k != "lockText"}}


def job_lock_check(_payload: dict) -> dict:
    rows = inspect(ROOT, load_lock(ROOT))
    return summary(rows)


def job_census(_payload: dict) -> dict:
    people = list(ACCOUNTS.glob("*.json")) if ACCOUNTS.is_dir() else []
    public = 0
    private = 0
    if USERS.is_dir():
        for d in USERS.iterdir():
            idx = d / "repos.json"
            try:
                doc = read(idx, {})
            except Exception:
                continue
            for r in doc.get("repos") or []:
                if r.get("visibility") == "private" or r.get("encrypted"):
                    private += 1
                else:
                    public += 1
    return {"ok": True, "people": len(people), "publicRepos": public, "privateRepos": private}


def job_reconcile(_payload: dict) -> dict:
    """If a vault exists and the user index forgot it, merge it back."""
    restored = []
    if not VAULTS.is_dir():
        return {"ok": True, "restored": []}
    for handle_dir in VAULTS.iterdir():
        if not handle_dir.is_dir():
            continue
        h = handle_dir.name
        repo_dir = handle_dir / "repos"
        if not repo_dir.is_dir():
            continue
        idx_file = USERS / h / "repos.json"
        doc = read(idx_file, {"handle": h, "repos": []}) if idx_file.is_file() else {"handle": h, "repos": []}
        if not isinstance(doc, dict):
            doc = {"handle": h, "repos": []}
        have = {r.get("id") for r in doc.get("repos") or [] if r.get("id")}
        changed = False
        for f in repo_dir.glob("*.json"):
            rec = read(f, {})
            rid = rec.get("repoId") or rec.get("id")
            if not rid or rid in have:
                continue
            vis = rec.get("visibility") or "public"
            doc.setdefault("repos", []).append(
                {
                    "id": rid,
                    "owner": rec.get("owner") or h,
                    "name": str(rid).split("/", 1)[-1],
                    "description": rec.get("description") or "",
                    "visibility": vis,
                    "encrypted": vis == "private",
                    "fileCount": rec.get("fileCount") or 0,
                }
            )
            have.add(rid)
            changed = True
            restored.append(rid)
        if changed:
            write(idx_file, doc)
    return {"ok": True, "restored": restored}


def job_gc(_payload: dict) -> dict:
    n = 0
    for folder in (ROOT / "data", COMPUTERS):
        if not folder.exists():
            continue
        for p in folder.rglob("*.tmp"):
            try:
                p.unlink()
                n += 1
            except Exception:
                pass
    return {"ok": True, "removed": n}


def job_merkle(payload: dict) -> dict:
    repo = str(payload.get("repo") or payload.get("repoId") or "")
    if not repo:
        return {"ok": False, "error": "repo required"}
    safe = repo.replace("/", "_")[:80]
    home = COMPUTERS / safe
    files = []
    if home.is_dir():
        for p in home.rglob("*"):
            if not p.is_file():
                continue
            if any(part in {".git", "node_modules", ".kiln"} for part in p.parts):
                continue
            try:
                files.append({"path": str(p.relative_to(home)), "content": p.read_bytes()})
            except Exception:
                continue
            if len(files) >= 400:
                break
    tree = merkle_of_files(files)
    tree["ok"] = True
    tree["repo"] = repo
    return tree


def job_session_gc(_payload: dict) -> dict:
    doc = read(SESSIONS, {})
    if not isinstance(doc, dict):
        return {"ok": False, "error": "sessions not a map"}
    now = time.time() * 1000
    keep = {}
    for k, v in doc.items():
        if not isinstance(v, dict):
            continue
        exp = v.get("exp")
        if exp is None or float(exp) > now:
            keep[k] = v
    dropped = len(doc) - len(keep)
    if dropped:
        write(SESSIONS, keep)
    return {"ok": True, "kept": len(keep), "dropped": dropped}


def job_vault_check(_payload: dict) -> dict:
    handles = 0
    files = 0
    bad = []
    if VAULTS.is_dir():
        for d in VAULTS.iterdir():
            if not d.is_dir():
                continue
            handles += 1
            for f in d.rglob("*.json"):
                files += 1
                try:
                    json.loads(f.read_text(encoding="utf-8"))
                except Exception:
                    bad.append(str(f.relative_to(ROOT)))
    return {"ok": True, "handles": handles, "files": files, "bad": bad[:20]}


def job_badge_index(_payload: dict) -> dict:
    doc = read(BADGES, {"badges": []})
    present = 0
    missing = []
    for b in doc.get("badges") or []:
        tok = b.get("token")
        if not tok:
            continue
        jpg = BADGE_DIR / f"{tok}.jpg"
        if jpg.is_file():
            present += 1
        else:
            missing.append(tok)
    return {
        "ok": True,
        "total": len(doc.get("badges") or []),
        "present": present,
        "missing": missing[:20],
    }


def job_organism(_payload: dict) -> dict:
    doc = read(ORGANISM, {"name": "Kiln", "kind": "machine-reality", "census": {}})
    if not isinstance(doc, dict):
        doc = {"name": "Kiln", "kind": "machine-reality", "census": {}}
    c = job_census({})
    census = doc.get("census") if isinstance(doc.get("census"), dict) else {}
    census["people"] = c.get("people")
    census["publicRepos"] = c.get("publicRepos")
    census["privateRepos"] = c.get("privateRepos")
    doc["census"] = census
    doc["lastBeat"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    write(ORGANISM, doc)
    return {"ok": True, "census": census}


KERNEL_EDGES = [
    {"from": "conductor", "to": "architect", "kind": "plan", "label": "plan the tree"},
    {"from": "conductor", "to": "agi", "kind": "ask", "label": "ask Nova"},
    {"from": "conductor", "to": "scout", "kind": "scout", "label": "find the work"},
    {"from": "architect", "to": "builder", "kind": "build", "label": "implement the map"},
    {"from": "builder", "to": "reviewer", "kind": "review", "label": "read the diff"},
    {"from": "reviewer", "to": "builder", "kind": "build", "label": "request changes"},
    {"from": "reviewer", "to": "deployer", "kind": "ship", "label": "ship on approve"},
    {"from": "conductor", "to": "cipher", "kind": "seal", "label": "verify the vault"},
    {"from": "conductor", "to": "indexer", "kind": "index", "label": "keep memory honest"},
    {"from": "deployer", "to": "conductor", "kind": "ship", "label": "report preview"},
]


def _write_missing(path: Path, text: str) -> bool:
    if path.is_file():
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return True


def _count_files(home: Path) -> int:
    n = 0
    if not home.is_dir():
        return 0
    for p in home.rglob("*"):
        if not p.is_file():
            continue
        if any(part in {".git", "node_modules", ".kiln", "__pycache__"} for part in p.parts):
            continue
        n += 1
        if n >= 400:
            break
    return n


def _write_kernel(home: Path, repo_id: str) -> int:
    wrote = 0
    files = {
        "constitution.json": json.dumps(
            {
                "repo": repo_id,
                "rules": [
                    "One computer per repository.",
                    "A write is git commit. Use kiln_write_file.",
                    "Handoff, do not impersonate.",
                    "Seat yourself after a write.",
                    "Never exfiltrate vault keys.",
                    "Folder quota is 50 GiB. Cipher verifies.",
                    "The capsule boots index.html. Deployer ships it.",
                    "Speak git: clone, commit, push, pull, branch.",
                ],
            },
            indent=2,
        )
        + "\n",
        "graph.json": json.dumps({"repo": repo_id, "edges": KERNEL_EDGES}, indent=2) + "\n",
        "mailbox.json": json.dumps({"repo": repo_id, "messages": []}, indent=2) + "\n",
        "src/index.ts": f'export const boot = () => {{\n  console.log("{repo_id} kernel");\n}};\nboot();\n',
        "src/kernel.ts": (
            f'/** Crew kernel for {repo_id}. A write is a git commit. */\n'
            'export const ROLES = ["conductor", "agi", "architect", "builder", "reviewer", "deployer", "cipher", "indexer"] as const;\n'
            f'export function seat(role: (typeof ROLES)[number]) {{\n  return {{ role, repo: "{repo_id}", write: "kiln_write_file" }};\n}}\n'
        ),
        "AGENT.md": f"# Agent · {repo_id}\n\nCrew kernel for this computer. A write is a git commit.\n",
        "README.md": f"# {repo_id}\n\nOrchestrator home. Private. Computer, vault, and Kiln Base are seated.\n",
        "COMPUTER.md": f"# Computer on {repo_id}\n\nThis tree is a kiln. HOME is this folder. WSL · PowerShell · kilnsh.\n",
    }
    for rel, body in files.items():
        if _write_missing(home / rel, body):
            wrote += 1
    return wrote


def _ensure_home_base(handle: str) -> bool:
    root = BASE / handle / "home"
    schema = root / "SCHEMA.json"
    if schema.is_file():
        return False
    root.mkdir(parents=True, exist_ok=True)
    (root / "tables").mkdir(exist_ok=True)
    (root / "buckets").mkdir(exist_ok=True)
    (root / "vectors").mkdir(exist_ok=True)
    (root / "indexes").mkdir(exist_ok=True)
    now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    write(
        schema,
        {
            "spec": "kiln-base/v1",
            "repoId": f"{handle}/home",
            "isolation": f"kiln://{handle}/home",
            "cipher": "AES-256-GCM",
            "visibility": "private",
            "owner": handle,
            "createdAt": now,
            "tables": {
                "events": {"name": "events", "policy": "private", "rls": "owner"},
                "docs": {"name": "docs", "policy": "private", "rls": "owner", "vector": True},
                "objects": {"name": "objects", "policy": "private", "rls": "owner"},
            },
            "indexes": {"docs": ["owner", "title"], "events": ["kind", "owner"], "objects": ["bucket", "path"]},
        },
    )
    for t in ("events", "docs", "objects"):
        p = root / "tables" / f"{t}.json"
        if not p.is_file():
            write(p, {"table": t, "rows": []})
    return True


def _seat_handle(h: str) -> list[str]:
    repaired: list[str] = []
    if not h or h == "kiln":
        return repaired
    vault = VAULTS / h
    if not vault.is_dir():
        vault.mkdir(parents=True, exist_ok=True)
        (vault / "blobs").mkdir(exist_ok=True)
        (vault / "repos").mkdir(exist_ok=True)
        (vault / "agents").mkdir(exist_ok=True)
        repaired.append(f"vault:{h}")
    user = USERS / h
    user.mkdir(parents=True, exist_ok=True)
    mem = user / "memory.json"
    if not mem.is_file():
        write(mem, {"handle": h, "conductor": [], "agents": {}})
        repaired.append(f"memory:{h}")
    idx_file = user / "repos.json"
    doc = read(idx_file, {"handle": h, "repos": []}) if idx_file.is_file() else {"handle": h, "repos": []}
    if not isinstance(doc, dict):
        doc = {"handle": h, "repos": []}
    repos = doc.get("repos") if isinstance(doc.get("repos"), list) else []
    home_id = f"{h}/home"
    have = {r.get("id") for r in repos if isinstance(r, dict) and r.get("id")}
    home_dir = COMPUTERS / f"{h}_home"
    home_dir.mkdir(parents=True, exist_ok=True)
    (home_dir / ".kiln" / "memory").mkdir(parents=True, exist_ok=True)
    (home_dir / ".kiln" / "cache").mkdir(parents=True, exist_ok=True)
    wrote = _write_kernel(home_dir, home_id)
    if wrote:
        repaired.append(f"kernel:{h}:{wrote}")
    n = _count_files(home_dir)
    if home_id not in have:
        repos.append(
            {
                "id": home_id,
                "owner": h,
                "name": "home",
                "description": "Orchestrator home. Private.",
                "visibility": "private",
                "encrypted": True,
                "fileCount": n,
                "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            }
        )
        doc["handle"] = h
        doc["repos"] = repos
        write(idx_file, doc)
        repaired.append(f"catalog:{h}/home")
    else:
        for r in repos:
            if isinstance(r, dict) and r.get("id") == home_id and n and r.get("fileCount") != n:
                r["fileCount"] = n
                write(idx_file, doc)
                repaired.append(f"count:{h}/home")
                break
    cache_user = user / "cache"
    cache_user.mkdir(parents=True, exist_ok=True)
    cache_backend = CACHE / h
    cache_backend.mkdir(parents=True, exist_ok=True)
    catalog = [r.get("id") for r in repos if isinstance(r, dict) and r.get("id")]
    seat = {
        "handle": h,
        "isolation": f"kiln://{h}",
        "home": home_id,
        "seatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "catalog": catalog,
        "computers": len(catalog),
    }
    write(cache_user / "INDEX.json", seat)
    write(cache_backend / "SEAT.json", {"handle": h, "at": seat["seatedAt"], "kind": "seat", "home": home_id})
    write(home_dir / ".kiln" / "cache" / "SEAT.json", {"handle": h, "repoId": home_id, "at": seat["seatedAt"]})
    if _ensure_home_base(h):
        repaired.append(f"base:{h}/home")
    return repaired


def job_account_audit(payload: dict | None = None) -> dict:
    repaired: list[str] = []
    seated = 0
    want = str((payload or {}).get("handle") or "").strip()
    if ACCOUNTS.is_dir():
        for f in ACCOUNTS.glob("*.json"):
            h = f.stem
            if not h:
                continue
            if want and h != want:
                continue
            seated += 1
            repaired.extend(_seat_handle(h))
    return {"ok": True, "seated": seated, "repaired": repaired}


def job_seat(payload: dict) -> dict:
    h = str(payload.get("handle") or "").strip()
    if not h:
        return job_account_audit({})
    repaired = _seat_handle(h)
    return {"ok": True, "handle": h, "repaired": repaired}


HANDLERS = {
    "heartbeat": job_heartbeat,
    "lock_check": job_lock_check,
    "census": job_census,
    "reconcile": job_reconcile,
    "gc": job_gc,
    "merkle": job_merkle,
    "session_gc": job_session_gc,
    "vault_check": job_vault_check,
    "badge_index": job_badge_index,
    "organism": job_organism,
    "account_audit": job_account_audit,
    "seat": job_seat,
    "base_census": job_base_census,
    "base_index": job_base_index,
    "base_hooks": job_base_hooks,
    "wallet_audit": job_wallet_audit,
}
