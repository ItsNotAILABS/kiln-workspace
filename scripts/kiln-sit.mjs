/**
 * One briefing for an agent that just sat down.
 * Working memory, the bench cursor, the last ship, and the next move.
 */
import fs from "node:fs";
import path from "node:path";
import { receiptOf } from "./kiln-board.mjs";
import { readBench } from "./kiln-bench.mjs";
import { bootSpace, headBranch, gitRev, readMemory, spaceHome } from "./kiln-space.mjs";

function crewNames(repoId) {
  try {
    const doc = JSON.parse(fs.readFileSync(path.join(spaceHome(repoId), ".kiln", "crew.json"), "utf8"));
    const members = Array.isArray(doc.members) ? doc.members : Array.isArray(doc.crew) ? doc.crew : [];
    return members
      .map((member) => (member && (member.name || member.handle || member.id)) || "")
      .filter(Boolean)
      .slice(0, 8);
  } catch {
    return [];
  }
}

export function sitComputer(repoId) {
  const id = String(repoId || "").trim();
  if (!id || !id.includes("/")) return { ok: false, error: "repo required" };
  bootSpace({ repoId: id, owner: id.split("/")[0] });
  const dir = spaceHome(id);
  const memory = readMemory({ repoId: id });
  const entries = Array.isArray(memory.entries) ? memory.entries : [];
  const recent = entries.slice(-6).map((entry) => ({
    kind: entry.kind || "episodic",
    text: String(entry.text || "").slice(0, 180),
  }));
  const bench = readBench(id);
  const nextPhase = bench && bench.phases ? bench.phases[bench.cursor] : null;
  const receipt = receiptOf(id);
  const branch = headBranch(dir);
  const head = gitRev(dir).slice(0, 7);
  const working = memory.working ? String(memory.working.text || "").slice(0, 200) : "";
  let next = "Read the tree, then commit one file.";
  if (bench && bench.status === "held" && nextPhase) next = `Bench is held. Next phase is ${nextPhase.title}. Step once.`;
  else if (bench && bench.status === "working" && nextPhase) next = `Bench is working. Next phase is ${nextPhase.title}.`;
  else if (working) next = working;
  const crew = crewNames(id);
  const lines = [`KILN · ${id}`, `${branch} · ${head || "no commit"}`];
  if (working) lines.push(`Working: ${working}`);
  if (bench) lines.push(`Bench: ${bench.status || "open"} · ${bench.cursor}/${bench.phases.length}${nextPhase ? " · " + nextPhase.title : ""}`);
  if (receipt.ok && receipt.githubUrl) lines.push(`GitHub: ${receipt.githubUrl}`);
  else if (receipt.ok && receipt.app) lines.push(`App: ${receipt.app}`);
  if (crew.length) lines.push(`Crew: ${crew.join(", ")}`);
  lines.push(`Next: ${next}`);
  if (recent.length) {
    lines.push("Memory:");
    for (const entry of recent) lines.push(`- ${entry.kind} · ${entry.text}`);
  }
  return {
    ok: true,
    repoId: id,
    branch,
    head,
    working,
    bench: bench
      ? { status: bench.status, cursor: bench.cursor, of: bench.phases.length, next: nextPhase ? nextPhase.title : "" }
      : null,
    crew,
    recent,
    next,
    text: lines.join("\n"),
    note: "Print text. This is the computer. Do not clone.",
  };
}
