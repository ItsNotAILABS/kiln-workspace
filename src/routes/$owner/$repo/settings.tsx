import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { findRepo, kilnHost, useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/$owner/$repo/settings")({
  component: Settings,
});

function Settings() {
  const { owner, repo: name } = Route.useParams();
  const kiln = useKiln();
  const nav = useNavigate();
  const repo = findRepo(kiln, owner, name);
  const [section, setSection] = useState<"general" | "access" | "branches" | "webhooks" | "pages" | "secrets" | "danger">("general");
  const [description, setDescription] = useState(repo?.description ?? "");
  const [website, setWebsite] = useState(repo?.website ?? "");
  const [topics, setTopics] = useState(repo?.topics.join(", ") ?? "");
  const [collab, setCollab] = useState("");
  const [branch, setBranch] = useState("");
  const [hook, setHook] = useState("");
  const [secret, setSecret] = useState("");
  const [newName, setNewName] = useState(repo?.name ?? "");
  if (!repo) return null;
  const collabs = kiln.collaborators[repo.id] ?? [repo.owner];
  const host = kiln.domains.find((d) => d.repoId === repo.id)?.host ?? kilnHost(repo.owner, repo.name);
  const page = kiln.pages.find((p) => p.repoId === repo.id);
  const navItems = [
    ["general", "General"],
    ["access", "Collaborators"],
    ["branches", "Branches"],
    ["webhooks", "Webhooks"],
    ["pages", "Pages"],
    ["secrets", "Secrets"],
    ["danger", "Danger zone"],
  ] as const;
  return (
    <div className="mt-5 grid gap-6 lg:grid-cols-[12rem_1fr]">
      <aside className="panel p-2">
        {navItems.map(([id, label]) => (
          <button key={id} type="button" className={`block w-full rounded-md px-3 py-2 text-left text-sm ${section === id ? "bg-surface-2" : "text-muted hover:text-fg"}`} onClick={() => setSection(id)}>
            {label}
          </button>
        ))}
      </aside>
      <div className="space-y-8">
        {section === "general" ? (
          <section className="panel space-y-3 p-5">
            <h2 className="font-display text-2xl">General</h2>
            <label className="block text-sm">
              Description
              <input className="input mt-1" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label className="block text-sm">
              Website
              <input className="input mt-1" value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
            <label className="block text-sm">
              Topics
              <input className="input mt-1" value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="comma,separated" />
            </label>
            <button
              type="button"
              className="btn h-9"
              onClick={() => kiln.updateRepo(repo.id, { description, website, topics: topics.split(",").map((t) => t.trim()).filter(Boolean) })}
            >
              Save
            </button>
            <div className="flex gap-3 text-sm">
              <button type="button" className="btn h-8" onClick={() => kiln.updateRepo(repo.id, { visibility: repo.visibility === "public" ? "private" : "public" })}>
                Make {repo.visibility === "public" ? "private" : "public"}
              </button>
              <button type="button" className="btn h-8" onClick={() => kiln.updateRepo(repo.id, { archived: !repo.archived })}>
                {repo.archived ? "Unarchive" : "Archive"}
              </button>
            </div>
          </section>
        ) : null}
        {section === "access" ? (
          <section className="panel space-y-3 p-5">
            <h2 className="font-display text-2xl">Collaborators</h2>
            <ul className="text-sm">
              {collabs.map((h) => (
                <li key={h} className="py-1 font-mono">
                  {h}
                </li>
              ))}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                kiln.addCollaborator(repo.id, collab);
                setCollab("");
              }}
            >
              <input className="input" value={collab} onChange={(e) => setCollab(e.target.value)} placeholder="handle" />
              <button type="submit" className="btn h-9">
                Add
              </button>
            </form>
          </section>
        ) : null}
        {section === "branches" ? (
          <section className="panel space-y-3 p-5">
            <h2 className="font-display text-2xl">Branches</h2>
            <ul className="text-sm">
              {kiln.branches.filter((b) => b.repoId === repo.id).map((b) => (
                <li key={b.name} className="flex justify-between py-1">
                  <span className="font-mono">{b.name}</span>
                  <span className="text-muted">{b.protected ? "protected" : b.sha}</span>
                </li>
              ))}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                kiln.createBranch(repo.id, branch || "work");
                setBranch("");
              }}
            >
              <input className="input" value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="new-branch" />
              <button type="submit" className="btn h-9">
                Create branch
              </button>
            </form>
          </section>
        ) : null}
        {section === "webhooks" ? (
          <section className="panel space-y-3 p-5">
            <h2 className="font-display text-2xl">Webhooks</h2>
            <ul className="text-sm">
              {kiln.webhooks.filter((w) => w.repoId === repo.id).map((w) => (
                <li key={w.id} className="font-mono">
                  {w.url} · {w.events.join(", ")}
                </li>
              ))}
              {!kiln.webhooks.some((w) => w.repoId === repo.id) ? <li className="text-muted">None yet.</li> : null}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (hook.trim()) kiln.addWebhook(repo.id, hook.trim(), ["push", "pull_request"]);
                setHook("");
              }}
            >
              <input className="input" value={hook} onChange={(e) => setHook(e.target.value)} placeholder="https://example.com/hook" />
              <button type="submit" className="btn h-9">
                Add webhook
              </button>
            </form>
          </section>
        ) : null}
        {section === "pages" ? (
          <section className="panel space-y-3 p-5">
            <h2 className="font-display text-2xl">Pages</h2>
            <p className="text-sm text-muted">Publish the working tree to {host}. Same idea as GitHub Pages.</p>
            <p className="text-sm">{page?.enabled ? "Enabled on main /" : "Disabled"}</p>
            <button type="button" className="btn h-9" onClick={() => kiln.setPages(repo.id, !page?.enabled)}>
              {page?.enabled ? "Disable Pages" : "Enable Pages"}
            </button>
          </section>
        ) : null}
        {section === "secrets" ? (
          <section className="panel space-y-3 p-5">
            <h2 className="font-display text-2xl">Actions secrets</h2>
            <ul className="text-sm">
              {kiln.secrets.filter((s) => s.repoId === repo.id).map((s) => (
                <li key={s.id} className="font-mono">
                  {s.name}
                </li>
              ))}
              {!kiln.secrets.some((s) => s.repoId === repo.id) ? <li className="text-muted">No secrets.</li> : null}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (secret.trim()) kiln.addSecret(repo.id, secret.trim());
                setSecret("");
              }}
            >
              <input className="input" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="SECRET_NAME" />
              <button type="submit" className="btn h-9">
                Add secret
              </button>
            </form>
          </section>
        ) : null}
        {section === "danger" ? (
          <section className="panel space-y-3 p-5">
            <h2 className="font-display text-2xl text-danger">Danger zone</h2>
            <label className="block text-sm">
              Rename
              <input className="input mt-1" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </label>
            <button
              type="button"
              className="btn h-9"
              onClick={() => {
                kiln.updateRepo(repo.id, { name: newName });
                nav({ to: "/$owner/$repo", params: { owner: repo.owner, repo: newName } });
              }}
            >
              Rename repository
            </button>
            <p className="text-sm text-muted">Delete this repository from the local forge. Seed trees reappear on reload unless you overwrote them.</p>
            <button
              type="button"
              className="btn-danger btn h-9"
              onClick={() => {
                kiln.deleteRepo(repo.id);
                nav({ to: "/" });
              }}
            >
              Delete repository
            </button>
          </section>
        ) : null}
      </div>
    </div>
  );
}
