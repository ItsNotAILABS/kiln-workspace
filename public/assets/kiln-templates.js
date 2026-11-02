/**
 * Forge templates in /new — the Create tab's template door
 * (completeness round, Item 4).
 *
 * The daemon has offered repo-creation templates since the platform
 * round — POST /v1/repos accepts a nested `template` spec and each
 * account keeps saved templates at /v1/templates — but the app never
 * surfaced them. The frozen Create form (new-DrGYWjdX.js, component
 * `me`) creates a SEALED LOCAL repo through the store and never calls
 * the daemon; this module adds the forge leg beside it, house-style:
 * a module-scope panel composed UNDER the page by the route chunk's
 * module-scope wrapper (the papers S() / _owner B() precedent). No
 * minified component body is touched.
 *
 * What the panel does, exactly:
 *  - It renders only while the Create form is on screen (the form's
 *    name input is its DOM signature; the tab state lives inside the
 *    frozen page and cannot be read any other way). On the Import tab,
 *    signed out, or wallet-less, the panel is absent.
 *  - With a forge account session (localStorage
 *    `kiln.daemon.session.v1`, the identity layer's daemon session) it
 *    fetches the account's saved templates — GET /api/forge/v1/templates
 *    through this origin's forge proxy, the kiln-papers.js door — and
 *    offers: a saved-template select, the daemon's built-in license
 *    choices, its .gitignore presets, and a README scaffold choice.
 *  - Without a session the selects render disabled with a plain note;
 *    creating works exactly as it does today.
 *  - The picks reach the daemon through a wrap on the store's
 *    `createRepo` action (installed on mount, restored on unmount):
 *    the original action runs FIRST and untouched — the local create
 *    the user already had, its result and its errors. Only after it
 *    succeeds, and only when a session exists AND at least one pick
 *    was made AND the created repo sits under the session's own owner
 *    (the daemon creates only under your own namespace), the wrap
 *    POSTs /v1/repos with the daemon's exact contract:
 *      { owner, repo, description?, visibility,
 *        template: { templateId?, license?, gitignore?, readme? } }
 *    (fields nested under `template`; `repo`, not `name`). A forge
 *    failure never fails the local create — it lands as a store
 *    notice carrying the daemon's error verbatim, as does an
 *    owner mismatch. No picks / no session → pure pass-through.
 */

import { i as reactNs, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { b as useStore } from "./store-sx46DNi5.js";
import { t as Link } from "./link-BhiAFiqq.js";

const R = reactNs(React(), 1);
const j = jsxmod();

const SESSION_KEY = "kiln.daemon.session.v1";
const LICENSES = ["MIT", "Apache-2.0", "GPL-3.0", "BSD-3-Clause"];
const GITIGNORES = ["node", "python"];

// ---------------------------------------------------------------- session

function sessionToken() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return s && typeof s.token === "string" && s.token ? s.token : null;
  } catch {
    return null;
  }
}

/** One call through the origin's forge proxy. Errors surface verbatim. */
async function forge(method, path, body) {
  const headers = {};
  const token = sessionToken();
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await fetch(`/api/forge${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {}
  if (!res.ok) {
    const msg =
      (data && (data.error?.message || data.error || data.message)) ||
      `forge answered ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : `forge answered ${res.status}`);
  }
  return data;
}

// ------------------------------------------------------- the create wrap

/** The panel's live picks, read by the wrap at create time. */
const live = {
  hasSession: false,
  owner: "",
  templateId: "",
  license: "",
  gitignore: "",
  readme: "", // "" default | "yes" | "no"
};

function pickedSpec() {
  const spec = {};
  if (live.templateId) spec.templateId = live.templateId;
  if (live.license) spec.license = live.license;
  if (live.gitignore) spec.gitignore = live.gitignore;
  if (live.readme) spec.readme = live.readme === "yes";
  return spec;
}

function notify(title, body, href) {
  try {
    const n = useStore.getState()?.notify;
    if (typeof n === "function") n(title, body, href);
  } catch {}
}

/** After a successful local create: the forge copy, when asked for. */
async function applyForgeTemplate(rec, args) {
  if (!live.hasSession || !sessionToken()) return;
  const spec = pickedSpec();
  if (!Object.keys(spec).length) return;
  const owner = (rec && rec.owner) || (args && args.owner) || "";
  const repo = (rec && rec.name) || (args && args.name) || "";
  if (!owner || !repo) return;
  if (live.owner && owner !== live.owner) {
    notify(
      "Forge template not applied",
      `${owner}/${repo} was created here, but the forge creates only under your own account (${live.owner}) — the template picks were not sent.`,
      `/${owner}/${repo}`,
    );
    return;
  }
  try {
    const body = { owner, repo, visibility: (args && args.visibility) || undefined, template: spec };
    if (args && typeof args.description === "string" && args.description)
      body.description = args.description;
    await forge("POST", "/v1/repos", body);
    notify(
      "Also created on the forge",
      `${owner}/${repo} — the template scaffolds are in its first commit on the forge.`,
      `/${owner}/${repo}`,
    );
  } catch (e) {
    notify(
      "Forge copy not created",
      `${owner}/${repo} exists here; the forge answered: ${String(e?.message || e)}`,
      `/${owner}/${repo}`,
    );
  }
}

let wrapInstalled = null; // { orig, wrapped }

function installWrap() {
  if (wrapInstalled) return;
  let st = null;
  try {
    st = useStore.getState();
  } catch {}
  if (!st || typeof st.createRepo !== "function") return;
  if (st.createRepo.__kilnTemplateWrap) return;
  const orig = st.createRepo;
  const wrapped = async (args) => {
    const rec = await orig(args);
    try {
      await applyForgeTemplate(rec, args);
    } catch {}
    return rec;
  };
  wrapped.__kilnTemplateWrap = true;
  wrapInstalled = { orig, wrapped };
  try {
    useStore.setState({ createRepo: wrapped });
  } catch {}
}

function removeWrap() {
  if (!wrapInstalled) return;
  const { orig, wrapped } = wrapInstalled;
  wrapInstalled = null;
  try {
    if (useStore.getState()?.createRepo === wrapped)
      useStore.setState({ createRepo: orig });
  } catch {}
}

// ---------------------------------------------------------------- pieces

function pickedSummary(t) {
  if (!t) return "";
  const parts = [];
  if (t.licenseId) parts.push(`license ${t.licenseId}`);
  else if (t.licenseText) parts.push("custom license");
  if (t.readme) parts.push("README");
  if (t.gitignore) parts.push(`.gitignore: ${t.gitignore}`);
  if (Array.isArray(t.files) && t.files.length)
    parts.push(`${t.files.length} file${t.files.length === 1 ? "" : "s"}`);
  return parts.length
    ? `This template carries: ${parts.join(" · ")}. Inline picks below override it.`
    : "This template carries no scaffolds of its own — the inline picks below decide.";
}

export function KilnNewTemplatePanel() {
  const [formPresent, setFormPresent] = R.useState(false);
  const [hasSession, setHasSession] = R.useState(false);
  const [templates, setTemplates] = R.useState(null); // null = not loaded
  const [tplError, setTplError] = R.useState("");
  const [meOwner, setMeOwner] = R.useState("");
  const [templateId, setTemplateId] = R.useState("");
  const [license, setLicense] = R.useState("");
  const [gitignore, setGitignore] = R.useState("");
  const [readme, setReadme] = R.useState("");

  // The create wrap lives as long as the /new page does.
  R.useEffect(() => {
    installWrap();
    return () => removeWrap();
  }, []);

  // Render only beside the Create form: its name input is the signature
  // (tab state is internal to the frozen page; the form exists only on
  // the Create tab with a wallet connected).
  R.useEffect(() => {
    const check = () => {
      let present = false;
      try {
        present = Boolean(
          document.querySelector('input[placeholder="sealed-runtime"]'),
        );
      } catch {}
      setFormPresent(present);
      setHasSession(Boolean(sessionToken()));
    };
    check();
    let obs = null;
    try {
      obs = new MutationObserver(check);
      obs.observe(document.body, { childList: true, subtree: true });
    } catch {}
    const iv = setInterval(check, 700);
    return () => {
      try {
        obs && obs.disconnect();
      } catch {}
      clearInterval(iv);
    };
  }, []);

  // With a session: the account's saved templates + its owner.
  R.useEffect(() => {
    if (!formPresent || !hasSession || templates !== null) return;
    let dead = false;
    (async () => {
      try {
        const data = await forge("GET", "/v1/templates");
        if (!dead) setTemplates(Array.isArray(data?.templates) ? data.templates : []);
      } catch (e) {
        if (!dead) {
          setTemplates([]);
          setTplError(String(e?.message || e));
        }
      }
      try {
        const me = await forge("GET", "/v1/accounts/me");
        const owner = me && (me.owner || me.account?.owner);
        if (!dead && owner) setMeOwner(String(owner));
      } catch {}
    })();
    return () => {
      dead = true;
    };
  }, [formPresent, hasSession, templates]);

  // Keep the wrap's view of the picks current.
  R.useEffect(() => {
    live.hasSession = hasSession;
    live.owner = meOwner;
    live.templateId = templateId;
    live.license = license;
    live.gitignore = gitignore;
    live.readme = readme;
  }, [hasSession, meOwner, templateId, license, gitignore, readme]);

  if (!formPresent) return null;

  const picked = (templates || []).find((t) => t.id === templateId) || null;
  const sel = (label, value, onChange, options, disabled) =>
    j.jsxs("label", {
      className: "block text-xs uppercase tracking-[0.16em] text-muted",
      children: [
        label,
        j.jsx("select", {
          key: "s",
          className: "input mt-1.5",
          value,
          disabled: Boolean(disabled),
          onChange: (e) => onChange(e.target.value),
          children: options.map(([v, l]) => j.jsx("option", { value: v, children: l }, v || "__d")),
        }),
      ],
    });

  return j.jsx("div", {
    className: "mx-auto w-full max-w-2xl",
    children: j.jsxs("div", {
      className: "mt-8 rounded-lg border border-border bg-surface p-5",
      children: [
        j.jsx("h2", {
          key: "h",
          className: "font-display text-2xl tracking-tight",
          children: "Forge template",
        }),
        j.jsx("p", {
          key: "intro",
          className: "mt-2 text-sm leading-relaxed text-muted",
          children: hasSession
            ? "Your forge account's creation templates. Make any pick here, then Create repository above — the repository is also created on the forge, with the template's scaffolds (license, README, .gitignore, and any files the template carries) in its first commit. No pick, no forge copy: creating stays exactly as it is today."
            : "Repositories can be born from a template on the forge — a saved template of yours, or the forge's built-in license, README and .gitignore scaffolds in the first commit.",
        }),
        j.jsxs("div", {
          key: "grid",
          className: "mt-4 grid gap-3 sm:grid-cols-2",
          children: [
            sel(
              "Saved template",
              templateId,
              setTemplateId,
              [
                ["", !hasSession ? "Forge account needed" : templates === null ? "Reading your templates…" : "No saved template"],
                ...((templates || []).map((t) => [t.id, t.name])),
              ],
              !hasSession || templates === null || Boolean(tplError),
            ),
            sel(
              "Forge license",
              license,
              setLicense,
              [
                ["", "Default — the template's, or none"],
                ...LICENSES.map((l) => [l, l]),
                ["none", "No license"],
              ],
              !hasSession,
            ),
            sel(
              ".gitignore",
              gitignore,
              setGitignore,
              [
                ["", "Default — the template's, or none"],
                ...GITIGNORES.map((g) => [g, g === "node" ? "Node" : "Python"]),
                ["none", "No .gitignore"],
              ],
              !hasSession,
            ),
            sel(
              "README",
              readme,
              setReadme,
              [
                ["", "Default — the template's"],
                ["yes", "Scaffold a README.md"],
                ["no", "No README"],
              ],
              !hasSession,
            ),
          ],
        }),
        picked
          ? j.jsx("p", { key: "sum", className: "mt-3 text-[11px] text-subtle", children: pickedSummary(picked) })
          : null,
        tplError
          ? j.jsx("p", {
              key: "err",
              className: "mt-3 text-sm leading-relaxed text-muted",
              children: `Your saved templates did not answer (${tplError}) — the saved-template pick is off, but the built-in license, .gitignore and README picks still ride along at create; a forge error there is reported, never hidden.`,
            })
          : null,
        !hasSession
          ? j.jsxs("p", {
              key: "nosess",
              className: "mt-3 text-sm leading-relaxed text-muted",
              children: [
                "Templates need a forge account session — creating here works as usual without one. ",
                j.jsx(Link, { key: "a", to: "/account", className: "text-seal", children: "Connect a forge account" }),
                " and your saved templates appear here.",
              ],
            })
          : meOwner
            ? j.jsx("p", {
                key: "owner",
                className: "mt-3 text-[11px] text-subtle",
                children: `Forge account: ${meOwner} — the forge creates only under your own name, so picks apply to repositories you create under ${meOwner}.`,
              })
            : null,
      ],
    }),
  });
}
