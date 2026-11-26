"""Single kiln.runtime process. PID file + flock. Not a public surface."""

from __future__ import annotations

import fcntl
import os
import signal
import time
from pathlib import Path

from . import health as healthmod
from .log import log
from .paths import BACKEND, LOCKF, PID

_HOLD = None


def process_is_runtime(pid: int | None) -> bool:
    if not pid or pid <= 1:
        return False
    proc = Path(f"/proc/{pid}")
    if not proc.is_dir():
        return False
    try:
        cmd = (proc / "cmdline").read_bytes().replace(b"\0", b" ")
    except Exception:
        return False
    return b"kiln.runtime" in cmd or b"kiln/runtime.py" in cmd or b"-m kiln.runtime" in cmd


def running(max_age: float = 25.0) -> bool:
    pid = healthmod.read_pid()
    if not process_is_runtime(pid):
        return False
    doc = healthmod.read()
    try:
        age = time.time() - float(doc.get("at") or 0)
    except (TypeError, ValueError):
        return False
    return age < max_age


def _flock() -> bool:
    global _HOLD
    BACKEND.mkdir(parents=True, exist_ok=True)
    fp = open(LOCKF, "a+", encoding="utf-8")
    try:
        fcntl.flock(fp, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        fp.close()
        return False
    fp.seek(0)
    fp.truncate()
    fp.write(str(os.getpid()))
    fp.flush()
    _HOLD = fp
    return True


def claim() -> bool:
    """Become the runtime. False if another live runtime already holds the seat."""
    pid = healthmod.read_pid()
    if process_is_runtime(pid) and pid != os.getpid():
        if running():
            return False
        log(f"supervisor reclaim stale pid {pid}")
        try:
            os.kill(pid, signal.SIGTERM)
            time.sleep(0.25)
        except Exception:
            pass
    if not _flock():
        return False
    healthmod.write_pid()
    try:
        PID.write_text(str(os.getpid()), encoding="utf-8")
    except Exception:
        pass
    log(f"supervisor claimed pid {os.getpid()}")
    return True
