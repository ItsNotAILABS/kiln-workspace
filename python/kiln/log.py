"""Append-only runtime log. Not a public page."""

from __future__ import annotations

import time

from .paths import LOG


def log(msg: str) -> None:
    line = time.strftime("%H:%M:%S") + " " + str(msg) + "\n"
    try:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            f.write(line)
    except Exception:
        pass
