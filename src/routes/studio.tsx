import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { studioGenerate } from "@/lib/kiln/github";
import { langOf, useKiln } from "@/lib/kiln/store";
import type { RepoFile } from "@/lib/kiln/types";
import { AppErrorComponent } from "@/lib/error-component";

export const Route = createFileRoute("/studio")({
  validateSearch: (s: Record<string, unknown>) => ({
    prompt: typeof s.prompt === "string" ? s.prompt : "",
  }),
  errorComponent: AppErrorComponent,
  component: StudioGate,
});

/** Live grok.me SSR was crashing here — paint only after the client is up. */
function StudioGate() {
  const [live, setLive] = useState(false);
  useEffect(() => setLive(true), []);
  if (!live) {
    return (
      <div className="px-4 py-24 text-center">
        <p className="font-display text-4xl tracking-tight">Studio</p>
        <p className="mt-3 text-sm text-muted">Opening the forge…</p>
      </div>
    );
  }
  return <Studio />;
}

function studioPromptFromUrl() {
  try {
    return new URLSearchParams(window.location.search).get("prompt") || "";
  } catch {
    return "";
  }
}

function Studio() {
  let fromRoute = "";
  try {
    fromRoute = Route.useSearch().prompt || "";
  } catch {
    fromRoute = studioPromptFromUrl();
  }
  const [prompt, setPrompt] = useState(fromRoute);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const kiln = useKiln();
  const nav = useNavigate();

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!kiln.wallet) kiln.connect("you");
    setBusy(true);
    setError("");
    try {
      const res = await studioGenerate({ data: { prompt } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const files: RepoFile[] = (res.files || []).map((f) => ({
        path: f.path,
        language: langOf(f.path),
        content: f.content,
        size: f.content.length,
        sha: f.path,
        message: "studio genesis",
        updatedAt: new Date().toISOString(),
      }));
      const repo = kiln.createRepo({
        name: res.name || "studio-project",
        description: res.description || prompt.slice(0, 140),
        visibility: "public",
        kind: "code",
        files,
      });
      if (repo) nav({ to: "/$owner/$repo", params: { owner: repo.owner, repo: repo.name } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Studio failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-h-[calc(100dvh-3.5rem)]">
      <video
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-30"
        src="/marketing/lab.mp4"
        poster="/marketing/lab.jpg"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/80 to-bg" />
      <div className="relative mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-3xl flex-col justify-center px-4 py-16">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-accent">Studio</p>
        <h1 className="mt-3 font-display text-5xl leading-[0.95] sm:text-7xl">One-shot a project</h1>
        <p className="mt-4 max-w-xl text-muted">
          Describe the computer. Studio writes a sealed repository — files, README, a working tree you can open, fork, and run.
        </p>
        <form onSubmit={run} className="mt-8">
          <textarea
            className="input min-h-[7.5rem] text-base"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A light-client in Rust that verifies Kiln headers…"
            required
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="submit" className="btn-primary btn h-10 px-5" disabled={busy}>
              {busy ? "Forging…" : "Forge repository"}
            </button>
            <span className="text-xs text-subtle">User-initiated · grok-4.5 · capped</span>
          </div>
          {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
        </form>
      </div>
    </div>
  );
}
