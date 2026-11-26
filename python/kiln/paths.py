"""Workspace paths. One map for watchers, workers, health."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "data"
BACKEND = DATA / "backend"
INBOX = BACKEND / "inbox"
QUEUE = BACKEND / "queue.json"
HEALTH = BACKEND / "HEALTH.json"
PID = BACKEND / "runtime.pid"
LOCKF = BACKEND / "runtime.lock"
CACHE = BACKEND / "cache"
ACCOUNTS = DATA / "accounts"
USERS = DATA / "users"
VAULTS = DATA / "vaults"
SESSIONS = DATA / "sessions.json"
BADGES = DATA / "badges.json"
MIND = DATA / "mind"
ORGANISM = MIND / "ORGANISM.json"
L1 = DATA / "l1.json"
COMPUTERS = ROOT / "computers"
PUBLIC = ROOT / "public"
LOCK_JSON = PUBLIC / "freeze" / "LOCK.json"
BADGE_DIR = PUBLIC / "badges"
BASE = DATA / "base"
LOG = Path("/tmp/kiln-backend.log")
