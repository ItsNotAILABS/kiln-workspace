import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/gpu")({ component: Gpu });

function Gpu() {
  const [info, setInfo] = useState("probing…");
  useEffect(() => {
    const g = navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } };
    if (!g.gpu) setInfo("No WebGPU adapter. Merkle fold on CPU.");
    else g.gpu.requestAdapter().then((a) => setInfo(a ? "WebGPU adapter present. Lattice paint ready." : "Adapter request returned empty. CPU fallback."));
  }, []);
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-5xl">WebGPU</h1>
      <p className="mt-4 text-muted">Merkle hashing and lattice paint on the GPU. Falls back to CPU if the browser has no adapter.</p>
      <p className="panel mt-6 p-5 font-mono text-sm">{info}</p>
    </div>
  );
}
