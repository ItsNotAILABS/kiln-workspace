import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/edit/$")({
  component: EditView,
});

function EditView() {
  const { owner, repo: name, _splat } = Route.useParams();
  const path = _splat || "README.md";
  const kiln = useKiln();
  const nav = useNavigate();
  const repo = findRepo(kiln, owner, name);
  const file = repo?.files.find((f) => f.path === path);
  const [content, setContent] = useState(file?.content ?? "");
  const [message, setMessage] = useState(`update ${path}`);
  if (!repo) return null;
  return (
    <form
      className="mt-5 space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        kiln.editFile(repo.id, path, content, message);
        nav({ to: "/$owner/$repo/blob/$", params: { owner, repo: name, _splat: path } });
      }}
    >
      <p className="font-mono text-sm">{path}</p>
      <textarea className="input min-h-[28rem] font-mono text-[13px]" value={content} onChange={(e) => setContent(e.target.value)} />
      <input className="input max-w-xl" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Commit message" />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary btn h-10 px-5">
          Commit to {repo.defaultBranch}
        </button>
        {file ? (
          <button
            type="button"
            className="btn-danger btn h-10"
            onClick={() => {
              kiln.deleteFile(repo.id, path);
              nav({ to: "/$owner/$repo", params: { owner, repo: name } });
            }}
          >
            Delete file
          </button>
        ) : null}
      </div>
    </form>
  );
}
