import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/shipaton")({
  component: Shipaton,
});

/** Shipaton eve: Tuesday, September 29, 2026. */
const SHIPATON = new Date("2026-09-29T00:00:00-05:00").getTime();

function useCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = Math.max(0, SHIPATON - now);
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms / 3600000) % 24),
    minutes: Math.floor((ms / 60000) % 60),
    seconds: Math.floor((ms / 1000) % 60),
    done: ms <= 0,
  };
}

const CHECKS = [
  { label: "Substrate boots clean on a fresh checkout", done: false },
  { label: "Books pipeline runs end-to-end with receipts", done: false },
  { label: "KILN registry entry live for sovereign-engine", done: true },
  { label: "Forge repo page wired with live GitHub stats", done: true },
  { label: "Demo path rehearsed for shipaton eve", done: false },
];

function Shipaton() {
  const c = useCountdown();
  const done = CHECKS.filter((x) => x.done).length;
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">Shipaton</p>
      <h1 className="mt-3 font-display text-4xl leading-[0.95] sm:text-6xl">Sovereign Books substrate</h1>
      <p className="mt-3 max-w-xl text-muted">
        Shipping eve is <span className="text-fg">Tuesday, September 29, 2026</span>. The substrate that
        Sovereign Books runs on, built in the open.
      </p>

      <div className="mt-8 grid grid-cols-4 gap-3 max-w-xl">
        {[
          [c.days, "days"],
          [c.hours, "hours"],
          [c.minutes, "min"],
          [c.seconds, "sec"],
        ].map(([v, label]) => (
          <div key={label as string} className="panel p-4 text-center">
            <p className="font-display text-4xl tabular-nums">{v}</p>
            <p className="mt-1 text-[11px] uppercase tracking-wider text-subtle">{label}</p>
          </div>
        ))}
      </div>
      {c.done && <p className="mt-4 text-emerald-400">Shipaton day is here. Ship it.</p>}

      <h2 className="mt-10 font-display text-2xl">Readiness</h2>
      <div className="mt-3 h-2 max-w-xl overflow-hidden rounded-full bg-border">
        <div className="h-full bg-seal transition-all" style={{ width: `${(done / CHECKS.length) * 100}%` }} />
      </div>
      <ul className="mt-4 max-w-xl space-y-2">
        {CHECKS.map((x) => (
          <li key={x.label} className="flex items-start gap-3 text-sm">
            <span
              className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                x.done ? "border-seal bg-seal/20 text-seal" : "border-border text-subtle"
              }`}
            >
              {x.done ? "✓" : "·"}
            </span>
            <span className={x.done ? "text-muted line-through" : ""}>{x.label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex gap-3">
        <Link to="/$owner/$repo" params={{ owner: "freddycreates", repo: "sovereign-engine" }} className="btn-primary btn h-9">
          Open the repo
        </Link>
        <Link to="/fleet" className="btn h-9">
          Fleet status
        </Link>
      </div>
    </div>
  );
}
