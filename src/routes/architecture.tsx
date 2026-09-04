import { createFileRoute } from "@tanstack/react-router";
import { VideoFrame } from "@/components/VideoFrame";

export const Route = createFileRoute("/architecture")({ component: Architecture });

function Architecture() {
  return (
    <div className="mx-auto max-w-3xl pb-20">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">KILN-WP-09 · Crew kernel</p>
      <h1 className="mt-3 font-display text-5xl leading-[0.95]">Architecture</h1>
      <p className="mt-4 text-muted">A repository is a computer. Agents are processes on it. The Studio UI does not own the loop — the kernel does. Work moves by handoff. The constitution is loaded into every turn.</p>
      <div className="mt-8">
        <VideoFrame src="/marketing/explainer.mp4" poster="/marketing/explainer.jpg" caption="The kernel, not the overlay" />
      </div>
      <ol className="mt-10 list-decimal space-y-3 pl-5 text-muted">
        <li>Commit headers always bind a 32-byte key commitment. Public trees write zeros.</li>
        <li>Leaves are 4 MiB, Merkle-folded, AES-256-GCM when sealed.</li>
        <li>Each folder is a 50 GiB deposit. Nested folders have independent caps.</li>
        <li>Issues lock KLN. Pulls merge. Releases tag. Actions run on the computer.</li>
        <li>A capsule is a connected region of the lattice plus an isolated runtime.</li>
      </ol>
    </div>
  );
}
