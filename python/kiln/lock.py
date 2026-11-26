"""Lock physics. Protected paths must match CAS / LOCK.json."""

from __future__ import annotations

import json
from pathlib import Path

from .merkle import sha256_hex

SPEC = "kiln-lock/v1"


def load_lock(root: Path) -> dict:
    p = root / "public" / "freeze" / "LOCK.json"
    doc = json.loads(p.read_text(encoding="utf-8"))
    if doc.get("spec") != SPEC or not isinstance(doc.get("files"), list):
        raise ValueError("LOCK.json is not kiln-lock/v1")
    return doc


def cas_path(root: Path, digest: str) -> Path:
    return root / "cas" / "sha256" / digest[:2] / digest


def inspect(root: Path, lock: dict | None = None) -> list[dict]:
    lock = lock or load_lock(root)
    rows = []
    for f in lock["files"]:
        dest = root / f["path"]
        expected = f["sha256"]
        cas = cas_path(root, expected)
        live = sha256_hex(dest.read_bytes()) if dest.is_file() else None
        if live is None:
            status = "missing"
        elif live == expected:
            status = "ok"
        else:
            status = "mismatch"
        rows.append(
            {
                "path": f["path"],
                "reason": f.get("reason") or "",
                "expected": expected,
                "live": live,
                "status": status,
                "cas": cas.is_file(),
            }
        )
    return rows


def summary(rows: list[dict]) -> dict:
    counts = {"ok": 0, "mismatch": 0, "missing": 0}
    for r in rows:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    return {
        "ok": counts["mismatch"] == 0 and counts["missing"] == 0,
        "counts": counts,
        "rows": rows,
        "text": "\n".join(f"{r['status'].upper()} {r['path']}" for r in rows),
    }
