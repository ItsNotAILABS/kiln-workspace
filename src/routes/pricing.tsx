import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/pricing")({ component: Pricing });

function Pricing() {
  const tiers = [
    { name: "Public", price: "0 KLN", blurb: "Public trees. Actions on the repo computer. 50 GiB folders.", items: ["Unlimited public repos", "kilnsh", "Issues, pulls, wiki", "Import GitHub"] },
    { name: "Sealed", price: "40 KLN / mo", blurb: "Private trees, viewer grants, WebGPU merkle.", items: ["Private + encrypted", "Viewer TTL grants", "Packages + pages", "Priority Actions"] },
    { name: "Lab", price: "240 KLN / mo", blurb: "Orgs, SAML-shaped invites, hardware enclaves.", items: ["Organizations", "Protected branches", "Audit log", "Resident crews"] },
  ];
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted">Pricing</p>
      <h1 className="mt-3 font-display text-5xl">Pay gas. Not seats.</h1>
      <p className="mt-3 max-w-xl text-muted">KLN pays settlement, bounties, and seal. The forge itself is a public good.</p>
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {tiers.map((t) => (
          <div key={t.name} className="panel p-6">
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">{t.name}</p>
            <p className="mt-2 font-display text-3xl">{t.price}</p>
            <p className="mt-2 text-sm text-muted">{t.blurb}</p>
            <ul className="mt-4 space-y-1 text-sm">
              {t.items.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
            <Link to="/new" className="btn-primary btn mt-6 h-9">
              Start
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
