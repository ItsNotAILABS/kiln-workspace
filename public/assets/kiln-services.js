/**
 * Services — the /services surface (Forge Services catalog).
 *
 * The frozen router admits no new route, so /services resolves through
 * /$owner with owner "services"; the _owner chunk's wrapper hands that
 * one owner value to this surface (the /repos, /agents and /workspaces
 * precedent).
 *
 * Contents (no fake data, ever):
 *  - the Forge Services registry record, read same-origin from
 *    /forge-services.json (public/forge-services.json in this repo —
 *    a verbatim copy of the house registry at
 *    pocketnova-wallets/forge-services/services-registry.json; agents
 *    can also read it through the forge contents API). One card per
 *    service: name, tagline, flagship badge, kind, the registry labels
 *    rendered verbatim, door / docs / console / discovery links, and
 *    the get-started text.
 *  - LIVE ENRICHMENT, best-effort and silent on failure: Coffer's
 *    public discovery door (GET /v1/pricing) and Sendapay's health
 *    door are re-read at view time; when a door answers, the live
 *    facts it actually returned render in a box marked LIVE, and the
 *    registry labels stay as the floor. When a door does not answer
 *    (offline, or CORS not yet open on that service), nothing renders
 *    in its place — an unreachable door is never shown as data and no
 *    value is ever invented. The Sends engine has no public door; its
 *    registry doorNote renders plainly instead.
 *
 * Nav: kiln-docker-nav.js — the nav-injection precedent — is loaded
 * only from public/index.html, which is a FROZEN file (freeze
 * LOCK.json), so no new script tag can be added there. The "Services"
 * anchor is therefore injected from inside this module, following the
 * docker-nav mechanics exactly (same nav lookup, one anchor at most,
 * brief polling for the shell, fully defensive — it can never throw
 * into the app).
 */
import { i as reactNs, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";

const R = reactNs(React(), 1);
const j = jsxmod();

// ------------------------------------------------------------ nav door
// Mirrors kiln-docker-nav.js: find the header nav (falling back to the
// fixed bottom bar via the /wallet anchor), insert at most ONE anchor,
// poll briefly because the shell mounts after this module evaluates.
try {
  const NAV_HREF = "/services";
  const NAV_MARK = "kiln-services-nav-link";
  let navDone = false;
  let navTries = 0;

  function findNav() {
    const headerNav = document.querySelector("header nav");
    if (headerNav) return headerNav;
    const wa = document.querySelector('a[href="/wallet"]');
    let n = wa;
    while (n && n !== document.body) {
      if (n.tagName === "NAV") return n;
      try {
        if (getComputedStyle(n).position === "fixed") return n;
      } catch {
        /* getComputedStyle is best-effort here */
      }
      n = n.parentElement;
    }
    return document.querySelector("nav");
  }

  function insertNav() {
    if (navDone) return true;
    const nav = findNav();
    if (!nav) return false;
    if (nav.querySelector(`a[href="${NAV_HREF}"]`) || nav.querySelector(`.${NAV_MARK}`)) {
      navDone = true;
      return true;
    }
    const sibling = nav.querySelector("a[href]");
    const a = document.createElement("a");
    a.href = NAV_HREF;
    a.textContent = "Services";
    a.className = ((sibling && sibling.getAttribute("class")) || "") + " " + NAV_MARK;
    a.setAttribute("data-kiln-services-nav", "1");
    nav.appendChild(a);
    navDone = true;
    return true;
  }

  if (!insertNav()) {
    const iv = setInterval(() => {
      navTries += 1;
      if (insertNav() || navTries >= 40) clearInterval(iv);
    }, 500);
  }
} catch {
  /* the nav door is an enhancement; silence is the correct failure mode */
}

// ------------------------------------------------------------ live doors

async function fetchJson(url, timeoutMs) {
  const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs || 6000) : null;
  try {
    const res = await fetch(url, ctl ? { signal: ctl.signal } : {});
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Coffer /v1/pricing → the live facts the door actually returned. */
function cofferFacts(data) {
  if (!data || typeof data !== "object") return null;
  const pricing = data.pricing && typeof data.pricing === "object" ? data.pricing : {};
  const trade = data.trade && typeof data.trade === "object" ? data.trade : {};
  const types = Array.isArray(data.wallet_types)
    ? data.wallet_types.map((t) => (t && typeof t.type === "string" ? t.type : null)).filter(Boolean)
    : Array.isArray(data.walletTypes)
      ? data.walletTypes.map((t) => (typeof t === "string" ? t : t && typeof t.type === "string" ? t.type : null)).filter(Boolean)
      : [];
  const facts = [];
  const network = typeof pricing.network === "string" ? pricing.network : typeof data.network === "string" ? data.network : null;
  if (network) facts.push({ k: "Network", v: network });
  if (typeof pricing.liveCharging === "boolean") {
    facts.push({ k: "Live charging", v: pricing.liveCharging ? "on" : "off" });
  }
  if (types.length) {
    facts.push({ k: "Wallet types", v: `${types.length} — ${types.join(", ")}` });
  }
  const fee = typeof trade.platform_fee === "string" ? trade.platform_fee : typeof trade.platformFee === "string" ? trade.platformFee : null;
  if (fee) facts.push({ k: "Platform fee (trade)", v: fee });
  return facts.length ? facts : null;
}

/** Sendapay /health → only the fields the door actually returned. */
function sendapayFacts(data, answered) {
  if (!answered) return null;
  const facts = [];
  if (data && typeof data === "object") {
    if (typeof data.status === "string") facts.push({ k: "Status", v: data.status });
    else if (data.ok === true) facts.push({ k: "Status", v: "ok" });
    if (typeof data.version === "string") facts.push({ k: "Version", v: data.version });
    if (typeof data.network === "string") facts.push({ k: "Network", v: data.network });
  }
  if (!facts.length) facts.push({ k: "Health door", v: "answered OK" });
  return facts;
}

// ------------------------------------------------------------ pieces

function LiveBox({ title, facts }) {
  if (!facts || !facts.length) return null;
  return j.jsxs("div", {
    className: "mt-4 rounded-lg border border-border bg-bg p-4",
    children: [
      j.jsx("p", {
        className: "text-[10px] uppercase tracking-[0.16em] text-seal",
        children: `● Live — ${title}`,
      }),
      j.jsx("dl", {
        className: "mt-2 grid gap-2 sm:grid-cols-2",
        children: facts.map((f) =>
          j.jsxs(
            "div",
            {
              children: [
                j.jsx("dt", { className: "text-[11px] uppercase tracking-[0.12em] text-muted", children: f.k }),
                j.jsx("dd", { className: "mt-0.5 break-words text-sm leading-relaxed", children: f.v }),
              ],
            },
            f.k,
          ),
        ),
      }),
    ],
  });
}

function doorLink(label, href) {
  if (!href) return null;
  return j.jsx(
    "a",
    {
      href,
      target: "_blank",
      rel: "noreferrer",
      className: "btn min-h-11",
      children: label,
    },
    label,
  );
}

function ServiceCard({ svc, live }) {
  const links = [
    doorLink("Door", svc.door),
    doorLink("Docs", svc.docs),
    doorLink("Console", svc.console),
    doorLink("Discovery", svc.discovery),
  ].filter(Boolean);
  const children = [
    j.jsxs(
      "div",
      {
        key: "head",
        className: "flex flex-wrap items-baseline gap-2",
        children: [
          j.jsx("h2", { className: "font-display text-2xl tracking-tight", children: svc.name || svc.id }),
          svc.flagship ? j.jsx("span", { className: "chip text-seal", children: "Flagship" }) : null,
          svc.kind ? j.jsx("span", { className: "chip", children: svc.kind }) : null,
        ],
      },
    ),
    svc.tagline
      ? j.jsx("p", { key: "tag", className: "mt-2 text-sm leading-relaxed text-muted", children: svc.tagline })
      : null,
    Array.isArray(svc.labels) && svc.labels.length
      ? j.jsx("ul", {
          key: "labels",
          className: "mt-3 flex flex-col gap-1.5",
          children: svc.labels.map((label, i) =>
            j.jsxs(
              "li",
              {
                className: "flex gap-2 text-sm leading-relaxed",
                children: [
                  j.jsx("span", { className: "text-subtle", children: "·" }),
                  j.jsx("span", { children: String(label) }),
                ],
              },
              i,
            ),
          ),
        })
      : null,
    svc.sdk ? j.jsx("p", { key: "sdk", className: "mt-3 font-mono text-xs leading-relaxed text-subtle", children: svc.sdk }) : null,
    svc.doorNote
      ? j.jsx("p", {
          key: "note",
          className: "mt-3 rounded-lg border border-border bg-bg px-3 py-2 text-sm leading-relaxed text-muted",
          children: svc.doorNote,
        })
      : null,
    j.jsx(LiveBox, { key: "live", title: live && live.title, facts: live && live.facts }),
    links.length
      ? j.jsx("div", { key: "links", className: "mt-4 flex flex-wrap gap-2", children: links })
      : null,
    svc.getStarted
      ? j.jsxs("div", {
          key: "start",
          className: "mt-4 border-t border-border pt-3",
          children: [
            j.jsx("p", { className: "text-[11px] uppercase tracking-[0.14em] text-muted", children: "Get started" }),
            j.jsx("p", { className: "mt-1.5 text-sm leading-relaxed text-muted", children: svc.getStarted }),
          ],
        })
      : null,
  ];
  return j.jsx("section", {
    className: "mt-6 rounded-xl border border-border bg-surface p-5",
    children: children.filter(Boolean),
  });
}

// ------------------------------------------------------------ surface

export function KilnServicesSurface() {
  const [registry, setRegistry] = R.useState(undefined); // undefined = loading, null = unreadable
  const [live, setLive] = R.useState({}); // service id -> { title, facts }

  R.useEffect(() => {
    let alive = true;
    (async () => {
      const data = await fetchJson("/forge-services.json");
      if (!alive) return;
      setRegistry(data && Array.isArray(data.services) ? data : null);
      if (!data || !Array.isArray(data.services)) return;
      // Live enrichment — each door independently, silent on failure.
      for (const svc of data.services) {
        if (!svc || typeof svc !== "object") continue;
        if (svc.id === "coffer" && svc.discovery) {
          const d = await fetchJson(svc.discovery);
          if (!alive) return;
          const facts = cofferFacts(d);
          if (facts) {
            setLive((prev) => ({ ...prev, coffer: { title: "read just now from Coffer's discovery door", facts } }));
          }
        } else if (svc.id === "sendapay" && svc.door) {
          const healthUrl = `${String(svc.door).replace(/\/+$/, "")}/health`;
          const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
          const timer = ctl ? setTimeout(() => ctl.abort(), 6000) : null;
          let answered = false;
          let parsed = null;
          try {
            const res = await fetch(healthUrl, ctl ? { signal: ctl.signal } : {});
            answered = !!res.ok;
            if (answered) {
              try {
                parsed = await res.json();
              } catch {
                parsed = null;
              }
            }
          } catch {
            answered = false;
          } finally {
            if (timer) clearTimeout(timer);
          }
          if (!alive) return;
          const facts = sendapayFacts(parsed, answered);
          if (facts) {
            setLive((prev) => ({ ...prev, sendapay: { title: "read just now from Sendapay's health door", facts } }));
          }
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const children = [
    j.jsxs("div", {
      key: "head",
      children: [
        j.jsx("p", { className: "text-[11px] uppercase tracking-[0.2em] text-muted", children: "Forge services" }),
        j.jsx("h1", { className: "mt-1 font-display text-4xl tracking-tight", children: "Forge Services" }),
        j.jsx("p", {
          className: "mt-2 max-w-2xl text-sm leading-relaxed text-muted",
          children:
            "The house's own production services, distributed through the forge: builders get them ready-made — wallets and vaults, the merchant money protocol, and the money-movement quote engine. Every card below is the registry record verbatim; where a service has a public discovery door, its live state is re-read at view time and marked live.",
        }),
        registry && registry.updated
          ? j.jsx("p", {
              className: "mt-2 font-mono text-[11px] text-subtle",
              children: `Registry ${registry.registry || "forge-services"} · updated ${registry.updated}`,
            })
          : null,
      ],
    }),
  ];

  if (registry === undefined) {
    children.push(j.jsx("p", { key: "load", className: "mt-6 text-sm text-muted", children: "Reading the services registry…" }));
  } else if (registry === null) {
    children.push(
      j.jsx("p", {
        key: "err",
        className: "mt-6 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-muted",
        children:
          "The services registry didn't answer on this origin, so there is nothing honest to show yet. The record itself lives at /forge-services.json and in this repository at public/forge-services.json.",
      }),
    );
  } else {
    for (const svc of registry.services) {
      if (!svc || typeof svc !== "object" || !svc.id) continue;
      children.push(j.jsx(ServiceCard, { key: svc.id, svc, live: live[svc.id] || null }));
    }
    if (registry.note) {
      children.push(
        j.jsx("p", { key: "note", className: "mt-6 max-w-2xl text-xs leading-relaxed text-subtle", children: registry.note }),
      );
    }
  }

  return j.jsx("div", { className: "mx-auto w-full max-w-5xl", children });
}
