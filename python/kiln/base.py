"""Kiln Base census. Tables, rows, vectors, WAL, indexes. Not a public page."""

from __future__ import annotations

from .paths import BASE, USERS
from .store import read, write
import json


def job_base_census(_payload: dict) -> dict:
    bases = 0
    tables = 0
    rows = 0
    vectors = 0
    wal = 0
    private = 0
    if not BASE.is_dir():
        return {"ok": True, "bases": 0, "tables": 0, "rows": 0, "vectors": 0, "wal": 0, "private": 0}
    for owner in BASE.iterdir():
        if not owner.is_dir():
            continue
        for repo in owner.iterdir():
            if not repo.is_dir():
                continue
            schema = repo / "SCHEMA.json"
            if not schema.is_file():
                continue
            bases += 1
            try:
                doc = read(schema, {})
            except Exception:
                doc = {}
            if isinstance(doc, dict) and doc.get("visibility") == "private":
                private += 1
            tdir = repo / "tables"
            if tdir.is_dir():
                for f in tdir.glob("*.json"):
                    tables += 1
                    try:
                        t = read(f, {})
                        rows += len(t.get("rows") or []) if isinstance(t, dict) else 0
                    except Exception:
                        pass
            vdir = repo / "vectors"
            if vdir.is_dir():
                for f in vdir.glob("*.json"):
                    try:
                        v = read(f, {})
                        vectors += len(v.get("items") or []) if isinstance(v, dict) else 0
                    except Exception:
                        pass
            w = repo / "WAL.jsonl"
            if w.is_file():
                try:
                    text = w.read_text(encoding="utf-8")
                    lines = [ln for ln in text.splitlines() if ln.strip()]
                    wal += len(lines)
                    if len(lines) > 5000:
                        keep = "\n".join(lines[-2000:]) + "\n"
                        w.write_text(keep, encoding="utf-8")
                except Exception:
                    pass
    return {
        "ok": True,
        "bases": bases,
        "tables": tables,
        "rows": rows,
        "vectors": vectors,
        "wal": wal,
        "private": private,
        "root": "data/base",
    }


def job_base_index(_payload: dict) -> dict:
    """Rebuild PostgREST-style indexes on the merkle tables. Proof stays the tree."""
    built = 0
    bases = 0
    if not BASE.is_dir():
        return {"ok": True, "bases": 0, "indexes": 0}
    for owner in BASE.iterdir():
        if not owner.is_dir():
            continue
        for repo in owner.iterdir():
            schema_p = repo / "SCHEMA.json"
            if not schema_p.is_file():
                continue
            schema = read(schema_p, {})
            idx = schema.get("indexes") if isinstance(schema, dict) else None
            if not isinstance(idx, dict) or not idx:
                idx = {"docs": ["owner", "title"], "events": ["kind", "owner"], "objects": ["bucket", "path"]}
            bases += 1
            idir = repo / "indexes"
            idir.mkdir(parents=True, exist_ok=True)
            for table, cols in idx.items():
                tpath = repo / "tables" / f"{table}.json"
                doc = read(tpath, {}) if tpath.is_file() else {}
                rows = doc.get("rows") or [] if isinstance(doc, dict) else []
                for col in cols or []:
                    m: dict = {}
                    for r in rows:
                        if not isinstance(r, dict):
                            continue
                        k = str(r.get(col) or "")
                        if not k:
                            continue
                        m.setdefault(k, []).append(r.get("id"))
                    write(idir / f"{table}__{col}.json", {"table": table, "col": col, "keys": len(m), "map": m})
                    built += 1
    return {"ok": True, "bases": bases, "indexes": built}


def job_base_hooks(_payload: dict) -> dict:
    """Deliver WAL webhook events. Merkle stays the proof; this is the HTTP edge."""
    import urllib.error
    import urllib.request

    posted = 0
    failed = 0
    scanned = 0
    if not BASE.is_dir():
        return {"ok": True, "posted": 0, "failed": 0, "scanned": 0}
    for owner in BASE.iterdir():
        if not owner.is_dir():
            continue
        for repo in owner.iterdir():
            wal = repo / "WAL.jsonl"
            if not wal.is_file():
                continue
            cursor_p = repo / "HOOKS.json"
            cursor = read(cursor_p, {"delivered": []}) if cursor_p.is_file() else {"delivered": []}
            if not isinstance(cursor, dict):
                cursor = {"delivered": []}
            done = set(cursor.get("delivered") or [])
            try:
                lines = [ln for ln in wal.read_text(encoding="utf-8").splitlines() if ln.strip()][-40:]
            except Exception:
                continue
            fresh = []
            for ln in lines:
                try:
                    ev = json.loads(ln)
                except Exception:
                    continue
                if not isinstance(ev, dict) or ev.get("kind") != "webhook":
                    continue
                eid = str(ev.get("id") or "")
                url = str(ev.get("url") or "")
                if not eid or eid in done or not url.startswith("http"):
                    continue
                scanned += 1
                body = json.dumps(
                    {
                        "repo": f"{owner.name}/{repo.name}",
                        "op": ev.get("op"),
                        "table": ev.get("table"),
                        "row": ev.get("row"),
                        "actor": ev.get("actor"),
                        "id": eid,
                    }
                ).encode("utf-8")
                req = urllib.request.Request(url, data=body, method="POST", headers={"content-type": "application/json"})
                try:
                    urllib.request.urlopen(req, timeout=2)
                    posted += 1
                    done.add(eid)
                    fresh.append(eid)
                except (urllib.error.URLError, TimeoutError, OSError):
                    failed += 1
            if fresh:
                keep = list(done)[-400:]
                write(cursor_p, {"delivered": keep, "updated": True})
    return {"ok": True, "posted": posted, "failed": failed, "scanned": scanned}


def job_wallet_audit(_payload: dict) -> dict:
    n = 0
    quantum = 0
    schemes = {}
    if USERS.is_dir():
        for f in USERS.glob("*/WALLET.json"):
            n += 1
            doc = read(f, {})
            if not isinstance(doc, dict):
                continue
            if doc.get("scheme") or doc.get("dsaPublicKey"):
                quantum += 1
            sch = str(doc.get("scheme") or "none")
            schemes[sch] = schemes.get(sch, 0) + 1
    return {"ok": True, "wallets": n, "quantum": quantum, "schemes": schemes}
