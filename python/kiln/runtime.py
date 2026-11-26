"""Kiln backend runtime — watchers + workers.

Not a public page. Node serves the product. This process keeps indexes,
lock, census, the job queue, vaults, and sessions honest.
"""

from __future__ import annotations

import argparse
import os
import signal
import time

from . import health as healthmod
from .log import log
from .queue import depth, enqueue, enqueue_once, finish, ingest_inbox, recover, take
from .supervisor import claim, running
from .watch import Watch
from .worker import run

STOP = False


def _stop(_sig=None, _frm=None) -> None:
    global STOP
    STOP = True


class Scheduler:
    def __init__(self) -> None:
        self._last: dict[str, float] = {}

    def due(self, name: str, every: float) -> bool:
        now = time.time()
        prev = self._last.get(name, 0.0)
        if now - prev >= every:
            self._last[name] = now
            return True
        return False


def boot() -> None:
    n = recover()
    if n:
        log(f"recovered {n} jobs")
    healthmod.write_pid()
    enqueue_once("lock_check", {}, priority=1)
    enqueue_once("reconcile", {}, priority=2)
    enqueue_once("census", {}, priority=3)
    enqueue_once("account_audit", {}, priority=4)
    enqueue_once("session_gc", {}, priority=5)
    enqueue_once("base_census", {}, priority=5)
    enqueue_once("base_index", {}, priority=6)
    enqueue_once("gc", {}, priority=8)
    enqueue_once("heartbeat", {}, priority=9)


def schedule(sched: Scheduler) -> None:
    if sched.due("heartbeat", 12):
        enqueue_once("heartbeat", {}, priority=9)
    if sched.due("gc", 40):
        enqueue_once("gc", {}, priority=8)
        enqueue_once("session_gc", {}, priority=7)
    if sched.due("census", 28):
        enqueue_once("census", {}, priority=6)
        enqueue_once("organism", {}, priority=6)
        enqueue_once("base_census", {}, priority=6)
        enqueue_once("base_index", {}, priority=6)
        enqueue_once("base_hooks", {}, priority=6)
    if sched.due("audit", 90):
        enqueue_once("vault_check", {}, priority=7)
        enqueue_once("badge_index", {}, priority=7)
        enqueue_once("account_audit", {}, priority=7)
        enqueue_once("wallet_audit", {}, priority=7)
        enqueue_once("lock_check", {}, priority=2)


def pump(watch: Watch, sched: Scheduler | None = None) -> dict:
    if sched:
        schedule(sched)
    inbox = ingest_inbox()
    changed = watch.tick()
    done = 0
    last = {"ok": True}
    for job in take(4):
        try:
            last = run(job)
            ok = bool(last.get("ok", True))
        except Exception as e:
            last = {"ok": False, "error": str(e)}
            ok = False
        finish(job["id"], ok, last)
        done += 1
        log(f"{job['kind']} {'ok' if ok else 'fail'} {last.get('error') or ''}".strip())
    snap = healthmod.probe()
    doc = healthmod.write(
        {
            "ok": True,
            "pid": os.getpid(),
            "lock": snap.get("lock"),
            "l1": snap.get("l1"),
            "people": snap.get("people"),
            "diskFree": snap.get("diskFree"),
            "queue": depth(),
            "inbox": inbox,
            "changed": changed[:8],
            "pumped": done,
        }
    )
    return doc


def loop(interval: float = 1.6) -> int:
    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    watch = Watch()
    sched = Scheduler()
    boot()
    log("runtime up")
    while not STOP:
        try:
            pump(watch, sched)
        except Exception as e:
            log("pump " + str(e))
            healthmod.write({"ok": False, "error": str(e), "pid": os.getpid()})
        time.sleep(interval)
    log("runtime stop")
    return 0


def probe_cmd() -> int:
    return 0 if running() else 1


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="kiln.runtime")
    p.add_argument("--once", action="store_true")
    p.add_argument("--probe", action="store_true")
    args = p.parse_args(argv)
    if args.probe:
        return probe_cmd()
    if args.once:
        watch = Watch()
        boot()
        pump(watch, Scheduler())
        return 0
    if not claim():
        log("runtime already seated")
        return 0
    return loop()


if __name__ == "__main__":
    raise SystemExit(main())
