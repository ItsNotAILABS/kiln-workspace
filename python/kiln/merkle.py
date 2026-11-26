"""Pairwise SHA-256 merkle. Same law as scripts/hash-pool.mjs."""

from __future__ import annotations

import hashlib
from typing import Iterable, Sequence


def sha256_hex(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def merkle_hex(leaves: Sequence[str]) -> str:
    """Binary merkle of SHA-256 hex leaves. Odd nodes duplicated."""
    if not leaves:
        return sha256_hex(b"")
    layer = [bytes.fromhex(h) for h in leaves]
    while len(layer) > 1:
        if len(layer) % 2 == 1:
            layer = layer + [layer[-1]]
        nxt = []
        for i in range(0, len(layer), 2):
            nxt.append(hashlib.sha256(layer[i] + layer[i + 1]).digest())
        layer = nxt
    return layer[0].hex()


def merkle_of_files(files: Iterable[dict]) -> dict:
    records = []
    for f in sorted(files or [], key=lambda x: str(x.get("path") or "")):
        path = str(f.get("path") or "")
        if not path:
            continue
        body = f.get("content")
        if body is None:
            body = f.get("body") or ""
        if not isinstance(body, (bytes, bytearray)):
            body = str(body).encode("utf-8")
        digest = sha256_hex(bytes(body))
        records.append({"path": path, "sha256": digest, "size": len(body)})
    root = merkle_hex([r["sha256"] for r in records])
    return {
        "alg": "sha256-pairwise",
        "root": root,
        "files": len(records),
        "bytes": sum(r["size"] for r in records),
        "leaves": records,
    }
