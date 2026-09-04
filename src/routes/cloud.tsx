import { createFileRoute } from "@tanstack/react-router";
import { VideoFrame } from "@/components/VideoFrame";

export const Route = createFileRoute("/cloud")({ component: Cloud });

function Cloud() {
  return (
    <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
      <div>
        <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Encrypted cloud</p>
        <h1 className="mt-3 font-display text-5xl leading-[0.95]">The folder is the deposit</h1>
        <p className="mt-4 text-muted">AES-256-GCM leaves. 50 GiB per folder. Viewer grants with TTL. Nothing unseals without a key commitment on-chain.</p>
      </div>
      <VideoFrame src="/marketing/lattice.mp4" poster="/marketing/lattice.jpg" />
    </div>
  );
}
