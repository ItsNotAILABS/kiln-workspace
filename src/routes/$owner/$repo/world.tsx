import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/world")({
  component: World,
});

function World() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState("");
  useEffect(() => {
    const c = canvas.current;
    if (!c || !repo) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const files = repo.files;
    const n = Math.max(8, Math.ceil(Math.sqrt(files.length)));
    const w = c.width;
    const h = c.height;
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, w, h);
    const cell = Math.min(w, h) / (n + 1);
    files.forEach((f, i) => {
      const x = (i % n) * cell + cell * 0.4;
      const y = Math.floor(i / n) * cell + cell * 0.4;
      const g = 90 + ((f.size * 13) % 80);
      ctx.fillStyle = `rgb(${g * 0.7},${g},${g * 1.1})`;
      ctx.fillRect(x, y, cell * 0.72, cell * 0.72);
    });
    const onMove = (e: MouseEvent) => {
      const r = c.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * w;
      const y = ((e.clientY - r.top) / r.height) * h;
      const col = Math.floor((x - cell * 0.4) / cell);
      const row = Math.floor((y - cell * 0.4) / cell);
      const i = row * n + col;
      setHover(files[i]?.path ?? "");
    };
    c.addEventListener("mousemove", onMove);
    return () => c.removeEventListener("mousemove", onMove);
  }, [repo]);
  if (!repo) return null;
  return (
    <div className="mt-5">
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted">4D folder memory</p>
      <h2 className="mt-2 font-display text-3xl">Lattice occupancy</h2>
      <p className="mt-2 max-w-xl text-sm text-muted">Each cell is a Merkle leaf. Hover a cell to read the path. Agents sit on cells; capsules boot from connected regions.</p>
      <div className="panel mt-4 overflow-hidden p-2">
        <canvas ref={canvas} width={960} height={420} className="h-auto w-full" />
      </div>
      <p className="mt-2 font-mono text-xs text-seal">{hover || "—"}</p>
    </div>
  );
}
