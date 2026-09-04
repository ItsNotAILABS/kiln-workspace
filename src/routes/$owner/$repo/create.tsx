import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/create")({
  component: CreateFile,
});

function CreateFile() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const nav = useNavigate();
  const repo = findRepo(kiln, owner, name);
  const [path, setPath] = useState("");
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("create file");
  if (!repo) return null;
  return (
    <form
      className="mt-5 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        const p = path.replace(/^\//, "").trim();
        if (!p) return;
        kiln.editFile(repo.id, p, content, message || `create ${p}`);
        nav({ to: "/$owner/$repo/blob/$", params: { owner, repo: name, _splat: p } });
      }}
    >
      <h1 className="font-display text-3xl">New file</h1>
      <p className="text-sm text-muted">
        Commit onto {repo.defaultBranch}. Paths can include folders — kiln/src/lib.rs.
      </p>
      <input className="input font-mono" required placeholder="path/to/file.ts" value={path} onChange={(e) => setPath(e.target.value)} />
      <textarea className="input min-h-[24rem] font-mono text-[13px]" value={content} onChange={(e) => setContent(e.target.value)} placeholder="File contents" />
      <input className="input max-w-xl" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Commit message" />
      <button type="submit" className="btn-primary btn h-10 px-5">
        Commit new file
      </button>
    </form>
  );
}
