"""Platform physics. Conservation laws the kiln actually obeys.

These are not metaphors. They are checks an agent can run on a tree
during a build. Failures are real: hash drift, isolation leak, merkle
mismatch.
"""

from __future__ import annotations

from .machine import host_of, isolation_of, seal
from .merkle import merkle_hex, merkle_of_files, sha256_hex


def law_hash_conservation(body: str | bytes = b"kiln") -> dict:
    a = sha256_hex(body)
    b = sha256_hex(body)
    return {"law": "hash-conservation", "ok": a == b, "digest": a}


def law_merkle_odd_leaf() -> dict:
    three = [sha256_hex(b"a"), sha256_hex(b"b"), sha256_hex(b"c")]
    four = [sha256_hex(b"a"), sha256_hex(b"b"), sha256_hex(b"c"), sha256_hex(b"c")]
    # Odd layer duplicates the last leaf. Three leaves == four with last repeated.
    return {
        "law": "merkle-odd-leaf",
        "ok": merkle_hex(three) == merkle_hex(four),
        "root": merkle_hex(three),
    }


def law_write_changes_root(files: list[dict]) -> dict:
    before = merkle_of_files(files)
    extra = list(files) + [{"path": "__kiln_probe__", "content": "probe"}]
    after = merkle_of_files(extra)
    ok = (not files and after["root"] != before["root"]) or after["root"] != before["root"]
    return {
        "law": "write-conservation",
        "ok": ok,
        "before": before["root"],
        "after": after["root"],
    }


def law_isolation(repo_a: str, repo_b: str) -> dict:
    if repo_a == repo_b:
        return {"law": "isolation", "ok": False, "error": "need two distinct repo ids"}
    a = isolation_of(repo_a)
    b = isolation_of(repo_b)
    ha = host_of(repo_a)
    hb = host_of(repo_b)
    return {
        "law": "isolation",
        "ok": a != b and ha != hb,
        "a": {"repo": repo_a, "isolation": a, "host": ha},
        "b": {"repo": repo_b, "isolation": b, "host": hb},
    }


def check_tree(repo: dict, other: dict | None = None) -> dict:
    machine = seal(repo)
    laws = [
        law_hash_conservation(),
        law_merkle_odd_leaf(),
        law_write_changes_root(repo.get("files") or []),
    ]
    if other and other.get("id") and other["id"] != repo.get("id"):
        laws.append(law_isolation(repo["id"], other["id"]))
    elif repo.get("id"):
        other_id = "kiln/other" if repo["id"] != "kiln/other" else "kiln/studio"
        laws.append(law_isolation(repo["id"], other_id))
    failed = [x for x in laws if not x.get("ok")]
    return {
        "ok": not failed,
        "repo": repo.get("id"),
        "isolation": machine["isolation"],
        "host": machine["domain"]["host"],
        "merkle": machine["ledger"]["merkle"],
        "laws": laws,
        "failed": [x["law"] for x in failed],
    }
