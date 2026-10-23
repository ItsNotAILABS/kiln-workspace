import { describe, it } from "node:test";
import assert from "node:assert/strict";
import registry from "./registry.json" with { type: "json" };

// The vendored registry is a committed snapshot of ItsNotAILABS/KILN's
// projects/registry.json (see scripts/sync-kiln.mjs). The app must never
// invent projects, so the schema gate pins the shape here.
describe("vendored project registry", () => {
  it("carries the canonical schema marker", () => {
    assert.equal(registry.schema, "kiln.project-registry.v1");
  });

  it("lists at least one project", () => {
    assert.ok(Array.isArray(registry.projects) && registry.projects.length > 0);
  });

  it("every project has the fields the app depends on", () => {
    for (const p of registry.projects) {
      assert.ok(typeof p.id === "string" && p.id.length > 0, "project.id");
      assert.ok(typeof p.name === "string" && p.name.length > 0, `project ${p.id}: name`);
      assert.ok(
        typeof p.repository === "string" && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(p.repository),
        `project ${p.id}: repository must be owner/name, got ${p.repository}`
      );
      assert.ok(typeof p.defaultBranch === "string" && p.defaultBranch.length > 0, `project ${p.id}: defaultBranch`);
    }
  });

  it("has no duplicate project ids or repositories", () => {
    const ids = registry.projects.map((p) => p.id);
    const repos = registry.projects.map((p) => p.repository.toLowerCase());
    assert.equal(new Set(ids).size, ids.length, "duplicate project id");
    assert.equal(new Set(repos).size, repos.length, "duplicate repository");
  });
});
