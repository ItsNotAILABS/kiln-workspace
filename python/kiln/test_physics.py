"""Real physics tests. No mocks."""

from __future__ import annotations

import json
import unittest
from pathlib import Path

from kiln.capsule import assemble
from kiln.lock import inspect, load_lock, summary
from kiln.machine import host_of, isolation_of, seal
from kiln.merkle import merkle_hex, merkle_of_files, sha256_hex
from kiln.physics import check_tree, law_isolation, law_merkle_odd_leaf
from kiln.tools import dispatch

ROOT = Path(__file__).resolve().parents[2]


class MerkleLaw(unittest.TestCase):
    def test_hash_is_a_function(self):
        self.assertEqual(sha256_hex(b"kiln"), sha256_hex("kiln"))
        self.assertEqual(len(sha256_hex(b"")), 64)

    def test_odd_leaf_duplicates(self):
        self.assertTrue(law_merkle_odd_leaf()["ok"])

    def test_write_moves_root(self):
        a = merkle_of_files([{"path": "a.txt", "content": "a"}])
        b = merkle_of_files([{"path": "a.txt", "content": "a"}, {"path": "b.txt", "content": "b"}])
        self.assertNotEqual(a["root"], b["root"])


class IsolationLaw(unittest.TestCase):
    def test_two_trees_do_not_share_origin(self):
        out = law_isolation("kiln/studio", "kiln/kiln")
        self.assertTrue(out["ok"])
        self.assertNotEqual(isolation_of("kiln/studio"), isolation_of("kiln/kiln"))
        self.assertNotEqual(host_of("kiln/studio"), host_of("kiln/kiln"))

    def test_same_id_is_a_fail(self):
        self.assertFalse(law_isolation("kiln/studio", "kiln/studio")["ok"])


class CapsuleLaw(unittest.TestCase):
    def test_fallback_injects_window_kiln(self):
        cap = assemble({"id": "kiln/studio", "owner": "kiln", "name": "studio", "files": []})
        self.assertIn("window.Kiln", cap["html"])
        self.assertEqual(cap["host"], "kiln-studio.kiln.app")
        self.assertEqual(cap["sandbox"], "allow-scripts allow-forms")

    def test_index_html_is_the_entry(self):
        cap = assemble(
            {
                "id": "alice/app",
                "owner": "alice",
                "name": "app",
                "files": [{"path": "index.html", "content": "<html><head></head><body>hi</body></html>"}],
            }
        )
        self.assertEqual(cap["entry"], "index.html")
        self.assertIn("hi", cap["html"])
        self.assertIn("window.Kiln", cap["html"])


class LockLaw(unittest.TestCase):
    def test_lock_file_is_kiln_lock(self):
        lock = load_lock(ROOT)
        self.assertEqual(lock["spec"], "kiln-lock/v1")
        paths = [f["path"] for f in lock["files"]]
        self.assertIn("public/assets/studio-tabs.js", paths)

    def test_studio_is_ok_or_named(self):
        rows = inspect(ROOT)
        studio = next(r for r in rows if r["path"].endswith("studio-tabs.js"))
        self.assertIn(studio["status"], ("ok", "mismatch"))
        self.assertTrue(studio["cas"])


class ToolDispatch(unittest.TestCase):
    def test_physics_tool(self):
        out = dispatch("kiln_physics", {"repo": "kiln/studio"})
        self.assertTrue(out.get("ok"), out)
        self.assertIn("hash-conservation", json.dumps(out))

    def test_unknown_tool_fails_closed(self):
        out = dispatch("kiln_nope", {})
        self.assertFalse(out["ok"])


class TreeCheck(unittest.TestCase):
    def test_empty_tree_still_has_isolation(self):
        out = check_tree({"id": "kiln/studio", "files": []})
        self.assertTrue(out["ok"], out)
        self.assertEqual(out["isolation"], "kiln://kiln/studio.git")


if __name__ == "__main__":
    unittest.main()
