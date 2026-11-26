"""Backend health snapshot. Written by the runtime. Node reads it. Not a page."""

from __future__ import annotations

import os
import time

from .lock import inspect, load_lock, summary
from .paths import ACCOUNTS, HEALTH, L1, PID, ROOT
from .store import read as read_json
from .store import write as write_json


def write(doc: dict) -> dict:
    body = {
        **doc,
        "at": time.time(),
        "iso": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
    write_json(HEALTH, body)
    return body


def read() -> dict:
    doc = read_json(HEALTH, {"ok": False, "error": "no health yet"})
    return doc if isinstance(doc, dict) else {"ok": False, "error": "bad health"}


def alive(max_age: float = 20.0) -> bool:
    from .supervisor import process_is_runtime

    pid = read_pid()
    if not process_is_runtime(pid):
        return False
    doc = read()
    try:
        return (time.time() - float(doc.get("at") or 0)) < max_age
    except (TypeError, ValueError):
        return False


def probe() -> dict:
    lock_ok = True
    lock_text = "lock n/a"
    try:
        rows = inspect(ROOT, load_lock(ROOT))
        s = summary(rows)
        lock_ok = bool(s.get("ok"))
        lock_text = s.get("text") or ""
    except Exception as e:
        lock_ok = False
        lock_text = str(e)
    l1_h = 0
    try:
        l1 = read_json(L1, {})
        l1_h = int(l1.get("height") or 0)
    except Exception:
        l1_h = 0
    people = 0
    try:
        people = len(list(ACCOUNTS.glob("*.json"))) if ACCOUNTS.is_dir() else 0
    except Exception:
        people = 0
    return {
        "lock": lock_ok,
        "lockText": lock_text,
        "l1": l1_h,
        "people": people,
        "diskFree": _disk_free(),
        "pid": os.getpid(),
    }


def _disk_free() -> int:
    try:
        st = os.statvfs(str(ROOT))
        return int(st.f_bavail * st.f_frsize)
    except Exception:
        return 0


def write_pid() -> None:
    PID.parent.mkdir(parents=True, exist_ok=True)
    PID.write_text(str(os.getpid()), encoding="utf-8")


def read_pid() -> int | None:
    try:
        return int(PID.read_text(encoding="utf-8").strip())
    except Exception:
        return None
