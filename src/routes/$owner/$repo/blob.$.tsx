import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileTree, PathCrumbs } from "@/components/RepoChrome";
import { Markdown } from "@/components/Markdown";
import { formatAgo } from "@/lib/utils";
import { findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/blob/$")({
  component: BlobView,
});

function BlobView() {
  const { owner, repo: name, _splat } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const path = _splat || "";
  const file = repo?.files.find((f) => f.path === path);
  const [wrap, setWrap] = useState(false);
  if (!repo) return null;
  const dir = path.includes("/") ? path.split("/").slice(0, -1).join("/") : "";
  const lines = file?.content.split("\n") ?? [];
  const md = /\.md$/i.test(path);
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[16rem_1fr]">
      <FileTree files={repo.files} owner={owner} name={name} current={path} dir={dir} />
      <div className="min-w-0 overflow-hidden rounded-xl border border-border">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface px-3 py-2 text-xs">
          <PathCrumbs owner={owner} name={name} dir={path} />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted">{file ? `${lines.length} lines · ${file.size} B · ${file.sha.slice(0, 7)}` : ""}</span>
            <button
              type="button"
              className="text-seal hover:underline"
              onClick={() => {
                if (file) {
                  navigator.clipboard.writeText(file.content);
                  toast("Copied");
                }
              }}
            >
              Copy
            </button>
            <button
              type="button"
              className="text-seal hover:underline"
              onClick={() => {
                if (!file) return;
                const blob = new Blob([file.content], { type: "text/plain" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = path.split("/").pop() || "file";
                a.click();
              }}
            >
              Raw
            </button>
            <Link to="/$owner/$repo/blame/$" params={{ owner, repo: name, _splat: path }} className="text-seal hover:underline">
              Blame
            </Link>
            <Link to="/$owner/$repo/commits" params={{ owner, repo: name }} className="text-seal hover:underline">
              History
            </Link>
            <Link to="/$owner/$repo/edit/$" params={{ owner, repo: name, _splat: path }} className="text-seal hover:underline">
              Edit
            </Link>
            <button type="button" className="text-muted hover:text-fg" onClick={() => setWrap((v) => !v)}>
              {wrap ? "No wrap" : "Wrap"}
            </button>
          </div>
        </div>
        {file ? (
          md ? (
            <div className="p-5">
              <Markdown source={file.content} />
            </div>
          ) : (
            <pre className={wrap ? "overflow-auto p-4 font-mono text-[12.5px] leading-6 whitespace-pre-wrap" : "overflow-auto p-4 font-mono text-[12.5px] leading-6"}>
              {lines.map((line, i) => (
                <div key={i} className="flex hover:bg-surface/80">
                  <span className="w-10 shrink-0 pr-3 text-right text-subtle select-none">{i + 1}</span>
                  <span className="whitespace-pre">{line || " "}</span>
                </div>
              ))}
            </pre>
          )
        ) : (
          <p className="p-8 text-center text-muted">File not in this tree.</p>
        )}
        {file ? (
          <p className="border-t border-border px-3 py-2 text-[11px] text-subtle">
            Last commit · {file.message} · {formatAgo(file.updatedAt)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
