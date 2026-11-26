"""Durable backend job queue. JSON on disk. Inbox is how Node hands work over."""

from __future__ import annotations

import time
import uuid

from .paths import INBOX, QUEUE
from .store import read, write


def _doc() -> dict:
    d = read(QUEUE, {"jobs": []})
    if not isinstance(d, dict):
        return {"jobs": []}
    if not isinstance(d.get("jobs"), list):
        d["jobs"] = []
    return d


def recover() -> int:
    """Jobs left in 'run' after a crash go back to queued."""
    doc = _doc()
    n = 0
    for j in doc.get("jobs") or []:
        if j.get("status") == "run":
            j["status"] = "queued"
            n += 1
    if n:
        write(QUEUE, doc)
    return n


def enqueue(kind: str, payload: dict | None = None, *, priority: int = 5) -> dict:
    doc = _doc()
    job = {
        "id": uuid.uuid4().hex[:12],
        "kind": str(kind),
        "payload": payload or {},
        "priority": int(priority),
        "status": "queued",
        "at": time.time(),
        "tries": 0,
    }
    jobs = [j for j in doc.get("jobs") or [] if j.get("status") in ("queued", "run")]
    jobs.append(job)
    doc["jobs"] = jobs[-400:]
    write(QUEUE, doc)
    return job


def enqueue_once(kind: str, payload: dict | None = None, *, priority: int = 5) -> dict:
    doc = _doc()
    for j in doc.get("jobs") or []:
        if j.get("kind") == kind and j.get("status") in ("queued", "run"):
            return j
    return enqueue(kind, payload, priority=priority)


def take(n: int = 4) -> list[dict]:
    doc = _doc()
    out = []
    for j in sorted(doc.get("jobs") or [], key=lambda x: (x.get("priority", 5), x.get("at", 0))):
        if j.get("status") != "queued":
            continue
        j["status"] = "run"
        j["tries"] = int(j.get("tries") or 0) + 1
        out.append(j)
        if len(out) >= n:
            break
    write(QUEUE, doc)
    return out


def finish(job_id: str, ok: bool, result: dict | None = None) -> None:
    doc = _doc()
    keep = []
    for j in doc.get("jobs") or []:
        if j.get("id") == job_id:
            if ok or int(j.get("tries") or 0) >= 5:
                continue
            j["status"] = "queued"
            j["lastError"] = (result or {}).get("error")
        keep.append(j)
    doc["jobs"] = keep[-400:]
    write(QUEUE, doc)


def depth() -> int:
    doc = _doc()
    return sum(1 for j in doc.get("jobs") or [] if j.get("status") in ("queued", "run"))


def ingest_inbox() -> int:
    INBOX.mkdir(parents=True, exist_ok=True)
    n = 0
    for p in sorted(INBOX.glob("*.json")):
        try:
            body = read(p, {})
            kind = body.get("kind") or body.get("job") or "heartbeat"
            enqueue(kind, body.get("payload") or body)
            n += 1
        except Exception:
            pass
        try:
            p.unlink()
        except Exception:
            pass
    return n
