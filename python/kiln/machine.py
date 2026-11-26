"""Sealed machine. Isolation is the repo id. Five facets, six banks."""

from __future__ import annotations

from .merkle import merkle_of_files

FACETS = ("shell", "memory", "models", "domain", "ledger")
BANKS = ("working", "episodic", "semantic", "procedural", "lattice", "folder")
PORTS = (
    {"port": 443, "service": "capsule", "proto": "https"},
    {"port": 7331, "service": "mcp", "proto": "tcp"},
    {"port": 3000, "service": "node", "proto": "http"},
    {"port": 8000, "service": "python", "proto": "http"},
    {"port": 7840, "service": "webgpu", "proto": "ws"},
)


def host_of(repo_id: str) -> str:
    parts = str(repo_id).split("/", 1)
    if len(parts) != 2 or not parts[0] or not parts[1]:
        raise ValueError(f"repo id must be owner/name, got {repo_id!r}")
    owner, name = parts
    return f"{owner}-{name}.kiln.app".replace("_", "-")


def isolation_of(repo_id: str) -> str:
    return f"kiln://{repo_id}.git"


def seal(repo: dict) -> dict:
    repo_id = repo.get("id") or repo.get("repo") or ""
    if not repo_id:
        raise ValueError("repo id required")
    files = repo.get("files") or []
    tree = merkle_of_files(files)
    host = host_of(repo_id)
    return {
        "spec": "kiln-machine/v1",
        "repoId": repo_id,
        "isolation": isolation_of(repo_id),
        "cipher": "AES-256-GCM",
        "facets": list(FACETS),
        "shell": {"cwd": "/", "ports": [dict(p) for p in PORTS]},
        "memory": {"banks": {k: [] for k in BANKS}, "scope": repo_id},
        "models": {
            "bound": repo.get("modelId") or "grok-4.6",
            "label": "Grok",
        },
        "domain": {
            "host": host,
            "origin": "blob",
            "status": "pending",
            "preview": f"/{repo_id}/preview",
        },
        "ledger": {
            "root": "0x" + tree["root"][:16],
            "alg": tree["alg"],
            "merkle": tree["root"],
            "files": tree["files"],
            "bytes": tree["bytes"],
        },
    }
