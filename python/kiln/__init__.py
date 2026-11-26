"""Kiln infrastructure models.

Python physics for the sealed machine: merkle, lock, capsule, isolation.
Callable as tools from Grok / crew during a build.
"""

from .merkle import merkle_hex, sha256_hex
from .machine import seal
from .physics import check_tree

__all__ = ["merkle_hex", "sha256_hex", "seal", "check_tree"]
