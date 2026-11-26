"""Poll kiln state. Enqueue work when trees, indexes, or the lock move."""

from __future__ import annotations

import os
from pathlib import Path

from .paths import ACCOUNTS, BADGES, BASE, COMPUTERS, L1, LOCK_JSON, MIND, SESSIONS, USERS, VAULTS
from .queue import enqueue, enqueue_once

WATCH = [
    L1,
    USERS,
    VAULTS,
    ACCOUNTS,
    COMPUTERS,
    LOCK_JSON,
    SESSIONS,
    BADGES,
    MIND,
    BASE,
]


def _stamp(path: Path) -> float:
    try:
        if path.is_file():
            return path.stat().st_mtime
        newest = path.stat().st_mtime
        with os.scandir(path) as it:
            for e in it:
                try:
                    newest = max(newest, e.stat().st_mtime)
                except OSError:
                    continue
        return newest
    except OSError:
        return 0.0


class Watch:
    def __init__(self) -> None:
        self._last: dict[str, float] = {}

    def tick(self) -> list[str]:
        fired = []
        for p in WATCH:
            key = str(p)
            now = _stamp(p)
            prev = self._last.get(key)
            self._last[key] = now
            if prev is None:
                continue
            if now > prev + 0.01:
                fired.append(p.name or key)
        if not fired:
            return fired
        enqueue("reconcile", {"changed": fired}, priority=4)
        names = set(fired)
        if "LOCK.json" in names:
            enqueue_once("lock_check", {}, priority=2)
        if "l1.json" in names:
            enqueue_once("census", {}, priority=6)
        if "badges.json" in names:
            enqueue_once("badge_index", {}, priority=7)
        if "sessions.json" in names:
            enqueue_once("session_gc", {}, priority=7)
        if "base" in names:
            enqueue_once("base_census", {}, priority=6)
            enqueue_once("base_index", {}, priority=6)
            enqueue_once("base_hooks", {}, priority=7)
        return fired
