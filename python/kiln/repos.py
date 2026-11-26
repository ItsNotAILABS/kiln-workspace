"""Load a kiln tree from the published kiln-account or a request body."""

from __future__ import annotations

import json
from pathlib import Path


def load_account(root: Path) -> dict:
    p = root / "public" / "kiln-account.json"
    if not p.is_file():
        return {"repos": []}
    return json.loads(p.read_text(encoding="utf-8"))


def find_repo(root: Path, repo_id: str, files: list | None = None) -> dict:
    if files is not None:
        parts = str(repo_id).split("/", 1)
        return {
            "id": repo_id,
            "owner": parts[0] if len(parts) == 2 else "kiln",
            "name": parts[1] if len(parts) == 2 else repo_id,
            "files": files,
        }
    doc = load_account(root)
    for r in doc.get("repos") or []:
        if r.get("id") == repo_id:
            return r
    parts = str(repo_id).split("/", 1)
    return {
        "id": repo_id,
        "owner": parts[0] if len(parts) == 2 else "kiln",
        "name": parts[1] if len(parts) == 2 else repo_id,
        "files": [],
    }
