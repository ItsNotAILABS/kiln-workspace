import { createFileRoute } from "@tanstack/react-router";
import { VideoFrame } from "@/components/VideoFrame";

export const Route = createFileRoute("/papers")({ component: Papers });

const PAPERS = [
  { id: "PXM", title: "Pixelated eXecution Memory", body: "A folder is a Hilbert-painted lattice of 4 MiB Merkle cells." },
  { id: "DEPOSIT", title: "Folder-as-deposit", body: "50 GiB per folder, not per record. File count unbounded." },
  { id: "CAPSULE", title: "Capsule-in-lattice", body: "The same 4D repo that stores the tree boots a sandboxed live preview." },
  { id: "REBEL", title: "Rebel occupancy", body: "Agents are first-class occupants of cells, not copilot chrome." },
];

function Papers() {
  return (
    <div>
      <div className="grid gap-6 lg:grid-cols-2 lg:items-end">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Working papers</p>
          <h1 className="mt-3 font-display text-5xl">The construction</h1>
        </div>
        <VideoFrame src="/marketing/papers.mp4" poster="/marketing/papers.jpg" />
      </div>
      <ul className="mt-8 space-y-3">
        {PAPERS.map((p) => (
          <li key={p.id} className="panel p-5">
            <p className="font-mono text-xs text-seal">{p.id}</p>
            <h2 className="mt-1 font-display text-2xl">{p.title}</h2>
            <p className="mt-2 text-muted">{p.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
