import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { findRepo, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/computer")({
  component: Computer,
});

function Computer() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const repo = findRepo(kiln, owner, name);
  const [cwd, setCwd] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const [cmd, setCmd] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!repo) return;
    setLines([
      `kilnsh · ${repo.id}`,
      `KILN_REPO=${repo.id}`,
      `sealed=${repo.encrypted} grant=${repo.viewerGrant}`,
      `type help`,
    ]);
  }, [repo?.id]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [lines]);
  if (!repo) return null;
  const files = repo.files;

  function run(raw: string) {
    const input = raw.trim();
    if (!input) return;
    const [bin, ...rest] = input.split(/\s+/);
    const arg = rest.join(" ");
    const out: string[] = [`$ ${input}`];
    const inCwd = (p: string) => (cwd ? p.startsWith(cwd + "/") || p === cwd : true);
    if (bin === "help") {
      out.push("ls  tree  cat  cd  pwd  git  memory  python  gpu  quota  merkle  whoami  clear  issue");
    } else if (bin === "clear") {
      setLines([]);
      return;
    } else if (bin === "pwd") out.push("/" + (cwd || repo!.name));
    else if (bin === "ls") {
      const prefix = cwd ? cwd + "/" : "";
      const kids = new Set<string>();
      files.filter((f) => inCwd(f.path)).forEach((f) => {
        const rel = prefix ? f.path.slice(prefix.length) : f.path;
        kids.add(rel.split("/")[0]!);
      });
      out.push([...kids].sort().join("  ") || "(empty)");
    } else if (bin === "tree") {
      files.filter((f) => inCwd(f.path)).slice(0, 40).forEach((f) => out.push("  " + f.path));
    } else if (bin === "cat") {
      const f = files.find((x) => x.path === arg || x.path === (cwd ? `${cwd}/${arg}` : arg));
      out.push(f ? f.content.slice(0, 4000) : "not found");
    } else if (bin === "cd") {
      if (arg === ".." || arg === "/") setCwd("");
      else setCwd(arg.replace(/\/$/, ""));
      out.push("ok");
    } else if (bin === "git") {
      if (rest[0] === "status") out.push("On branch " + repo!.defaultBranch, "nothing to commit, working tree sealed");
      else if (rest[0] === "log") files.slice(0, 5).forEach((f) => out.push(`${f.sha.slice(0, 7)}  ${f.message}`));
      else if (rest[0] === "branch") out.push(...kiln.branches.filter((b) => b.repoId === repo!.id).map((b) => (b.name === repo!.defaultBranch ? "* " : "  ") + b.name));
      else out.push("git clone | status | log | branch");
    } else if (bin === "memory") {
      const q = arg.toLowerCase();
      files.filter((f) => f.path.toLowerCase().includes(q) || f.content.toLowerCase().includes(q)).slice(0, 8).forEach((f) => out.push(f.path));
    } else if (bin === "python") {
      try {
        // eslint-disable-next-line no-new-func
        out.push(String(Function(`"use strict"; return (${arg})`)()));
      } catch {
        out.push("python: expression only");
      }
    } else if (bin === "gpu") out.push("adapter: fallback CPU · merkle fold on host");
    else if (bin === "quota") out.push(`folder cap 50 GiB · ${files.reduce((n, f) => n + f.size, 0)} bytes used`);
    else if (bin === "merkle") out.push(repo!.merkleRoot || "0x…");
    else if (bin === "whoami") out.push(kiln.wallet?.handle || "guest");
    else if (bin === "issue") out.push("see /issues — kilnsh does not hold the purse");
    else out.push(`kilnsh: ${bin}: not a verb`);
    setLines((l) => [...l, ...out]);
  }

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-border bg-black">
      <div className="flex items-center justify-between border-b border-border px-3 py-2 text-[11px] uppercase tracking-[0.16em] text-muted">
        <span>kilnsh · {repo.id}</span>
        <span className="text-ok">live</span>
      </div>
      <div className="h-[28rem] overflow-auto p-4 font-mono text-[12.5px] leading-6">
        {lines.map((l, i) => (
          <div key={i} className="whitespace-pre-wrap text-muted">
            {l}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="flex border-t border-border"
        onSubmit={(e) => {
          e.preventDefault();
          run(cmd);
          setCmd("");
        }}
      >
        <span className="px-3 py-2 font-mono text-seal">›</span>
        <input className="input min-h-11 border-0 bg-transparent font-mono" value={cmd} onChange={(e) => setCmd(e.target.value)} placeholder="ls · tree · git status · memory search" autoFocus />
      </form>
    </div>
  );
}
