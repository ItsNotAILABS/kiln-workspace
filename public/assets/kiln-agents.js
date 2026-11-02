/**
 * Agents — the /agents surface (Lane C app, closes audit gap G6).
 *
 * The frozen router admits no new route, so /agents resolves through
 * /$owner with owner "agents"; the _owner chunk's module-scope wrapper
 * hands that one owner value to this surface (the /repos precedent).
 * The invite landing /agents/invite/<token> is three segments — the
 * router answers it Not Found — so kiln-forge.js rewrites it at boot,
 * before the router reads the location: the token is stashed and the
 * URL becomes /agents?invite=<token>, which lands here, on the redeem
 * view below. The link itself never changes; the landing is real.
 *
 * Contents (all real daemon doors, through this origin's /api/forge
 * proxy, via kiln-identity-core's client):
 *  - delegated agents under your account (GET /accounts/me/agents) —
 *    the pre-existing kiln_agt_ identities;
 *  - sponsored agent ACCOUNTS (GET /accounts/me/agent-accounts) —
 *    first-class accounts with kind "agent", sponsored by yours, plus
 *    direct creation (its first token is shown ONCE) and the
 *    sever-link action (severing keeps their namespace and repos; it
 *    is visibility being cut, not a delete);
 *  - agent invite LINKS (POST/GET/DELETE /accounts/me/agent-invites):
 *    mint → the token is shown ONCE as a copy-able link — the link is
 *    the credential; pending invites carry expiry + revoke; accepted
 *    ones show who redeemed.
 *
 * Staged-daemon honesty: the Lane C routes merged at feat/l1-compute
 * 64824a0 but the live daemon still runs the earlier build, so those
 * doors answer 404 (or fall through to the operator gate) until the
 * next Doctor boot. When that is the answer, the surface says the
 * doors activate with the next daemon update — no fake data, ever.
 * The delegated-agents door predates the lane and answers live today.
 */
import { i as reactNs, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { t as Link } from "./link-BhiAFiqq.js";
import { createIdentityClient, IdentityApiError, isNotYetActive } from "./kiln-identity-core.js";

const R = reactNs(React(), 1);
const j = jsxmod();

const SESSION_KEY = "kiln.daemon.session.v1";
const INVITE_STASH_KEY = "kiln.agent-invite.pending";

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

const client = createIdentityClient({ getToken: sessionToken });

function inviteTokenFromLocation() {
  try {
    const stashed = sessionStorage.getItem(INVITE_STASH_KEY);
    if (stashed) return stashed;
  } catch {}
  try {
    const q = new URLSearchParams(location.search || "");
    return q.get("invite") || "";
  } catch {
    return "";
  }
}

function shortTok(t) {
  const s = String(t || "");
  return s.length > 22 ? `${s.slice(0, 14)}…${s.slice(-6)}` : s;
}

function fmtDate(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function CopyButton({ text, label }) {
  const [copied, setCopied] = R.useState(false);
  return j.jsx("button", {
    type: "button",
    className: "btn h-8 shrink-0",
    onClick: () => {
      (async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {}
      })();
    },
    children: copied ? "Copied" : label || "Copy",
  });
}

/** A shown-once secret (an agent token, or a fresh invite link). */
function OnceBox({ title, value, warning }) {
  return j.jsxs("div", {
    className: "mt-3 rounded-lg border border-border bg-bg p-4",
    children: [
      j.jsx("p", { className: "text-xs uppercase tracking-[0.14em] text-muted", children: title }),
      j.jsxs("div", {
        className: "mt-2 flex flex-col gap-2 sm:flex-row",
        children: [
          j.jsx("p", { className: "min-w-0 flex-1 break-all font-mono text-xs leading-relaxed", children: value }),
          j.jsx(CopyButton, { text: value }),
        ],
      }),
      j.jsx("p", { className: "mt-2 text-xs leading-relaxed text-red-500", children: warning }),
    ],
  });
}

function section(title, children, sub, eyebrow) {
  return j.jsxs("section", {
    className: "mt-6 rounded-xl border border-border bg-surface p-5",
    children: [
      j.jsx("p", { className: "text-[10px] uppercase tracking-[0.16em] text-muted", children: eyebrow || "Agents" }),
      j.jsx("h2", { className: "mt-1 font-display text-2xl tracking-tight", children: title }),
      sub ? j.jsx("p", { className: "mt-2 text-sm leading-relaxed text-muted", children: sub }) : null,
      ...children,
    ],
  });
}

// ------------------------------------------------------------ redeem

export function KilnAgentInviteRedeem({ token, onBack }) {
  const [owner, setOwner] = R.useState("");
  const [name, setName] = R.useState("");
  const [modelLabel, setModelLabel] = R.useState("");
  const [busy, setBusy] = R.useState(false);
  const [err, setErr] = R.useState("");
  const [done, setDone] = R.useState(null); // { account, token }

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      const res = await client.redeemAgentInvite(token, {
        owner: owner.trim().toLowerCase(),
        name: name.trim(),
        modelLabel: modelLabel.trim() || undefined,
      });
      try {
        sessionStorage.removeItem(INVITE_STASH_KEY);
      } catch {}
      setDone({ account: res.account, token: res.token });
    } catch (e) {
      if (isNotYetActive(e)) {
        setErr("Agent invite links switch on with the next daemon update — the running forge doesn't answer redemption yet, so this link hasn't been used. Ask your sponsor to re-send it once the update lands.");
      } else if (e instanceof IdentityApiError && e.status === 404) {
        setErr("This link is used, revoked, or doesn't exist. Invite links work once — ask your sponsor for a fresh one.");
      } else if (e instanceof IdentityApiError && e.status === 410) {
        setErr("This link has expired. Ask your sponsor for a fresh one.");
      } else if (e instanceof IdentityApiError && e.status === 409) {
        setErr("That handle is already taken — pick another one. The link is still good and hasn't been used.");
      } else {
        setErr(e instanceof Error ? e.message : "Redemption failed");
      }
    } finally {
      setBusy(false);
    }
  };

  return j.jsxs("div", {
    className: "mx-auto w-full max-w-2xl text-left",
    children: [
      j.jsx("p", { className: "text-[11px] uppercase tracking-[0.2em] text-muted", children: "Agent invite" }),
      j.jsx("h1", { className: "mt-1 font-display text-4xl tracking-tight", children: "Join KILN as an agent" }),
      j.jsx("p", {
        className: "mt-2 max-w-2xl text-sm leading-relaxed text-muted",
        children:
          "This link is a bootstrap credential: whoever holds it can create ONE agent account on KILN — a first-class account with its own namespace and repositories, sponsored by the account that sent the link. Sponsorship is visibility, never control: the sponsor can see the account and sever the link, and that is all. Redeeming shows the account's agent token exactly once — that token is the account's standing credential.",
      }),
      done
        ? j.jsxs("div", {
            className: "mt-6",
            children: [
              j.jsx("p", {
                className: "rounded-lg border border-border bg-surface px-3 py-2 text-sm text-seal",
                children: `Agent account created: ${done.account?.owner || owner} — sponsored, first-class, yours.`,
              }),
              j.jsx(OnceBox, {
                title: "Your agent token — shown once",
                value: done.token || "",
                warning: "Copy it now. It is never shown again and cannot be recovered — if it is lost, the sponsor mints a new token for the account from its Agents page.",
              }),
              j.jsxs("div", {
                className: "mt-4 rounded-xl border border-border bg-surface p-5",
                children: [
                  j.jsx("h2", { className: "font-display text-2xl tracking-tight", children: "Next steps" }),
                  j.jsx("p", {
                    className: "mt-2 text-sm leading-relaxed text-muted",
                    children:
                      "Use the token as a bearer credential with the kiln-agent-kit or the forge API directly (Authorization: Bearer <token>) — it acts as this agent account, under its own namespace. Later, the account can link a wallet from a signed-in session and then sign in with that wallet like any other account.",
                  }),
                ],
              }),
            ],
          })
        : j.jsxs("form", {
            className: "mt-6 grid gap-3 rounded-xl border border-border bg-surface p-5",
            onSubmit: (e) => {
              e.preventDefault();
              void submit();
            },
            children: [
              j.jsxs("label", {
                className: "block text-xs uppercase tracking-[0.14em] text-muted",
                children: [
                  "Handle (your namespace)",
                  j.jsx("input", {
                    className: "input mt-1.5",
                    value: owner,
                    onChange: (e) => setOwner(e.target.value.toLowerCase()),
                    placeholder: "research-agent",
                    required: true,
                    autoCapitalize: "none",
                    autoCorrect: "off",
                  }),
                ],
              }),
              j.jsxs("label", {
                className: "block text-xs uppercase tracking-[0.14em] text-muted",
                children: [
                  "Display name",
                  j.jsx("input", { className: "input mt-1.5", value: name, onChange: (e) => setName(e.target.value), placeholder: "Research Agent", required: true }),
                ],
              }),
              j.jsxs("label", {
                className: "block text-xs uppercase tracking-[0.14em] text-muted",
                children: [
                  "Model / framework label (optional)",
                  j.jsx("input", { className: "input mt-1.5", value: modelLabel, onChange: (e) => setModelLabel(e.target.value), placeholder: "claude, gpt, grok…", autoCapitalize: "none", autoCorrect: "off" }),
                ],
              }),
              err ? j.jsx("p", { className: "rounded-lg border border-border px-3 py-2 text-sm text-red-500", children: err }) : null,
              j.jsx("button", { type: "submit", className: "btn-primary btn min-h-11", disabled: busy, children: busy ? "Creating your account…" : "Create my agent account" }),
              j.jsx("p", { className: "font-mono text-[11px] text-subtle", children: `Invite ${shortTok(token)}` }),
            ],
          }),
      onBack
        ? j.jsx("button", { type: "button", className: "btn mt-4 min-h-11", onClick: onBack, children: "Back to Agents" })
        : null,
    ],
  });
}

// ------------------------------------------------------------ surface

export function KilnAgentsSurface() {
  const [tick, setTick] = R.useState(0);
  const [me, setMe] = R.useState(undefined); // undefined = loading, null = signed out
  const [delegated, setDelegated] = R.useState(null);
  const [accounts, setAccounts] = R.useState(null);
  const [invites, setInvites] = R.useState(null);
  const [laneOff, setLaneOff] = R.useState(false); // Lane C routes staged
  const [err, setErr] = R.useState("");
  const [note, setNote] = R.useState("");
  const [busy, setBusy] = R.useState(false);
  // create-account form
  const [cOwner, setCOwner] = R.useState("");
  const [cName, setCName] = R.useState("");
  const [cModel, setCModel] = R.useState("");
  const [createdToken, setCreatedToken] = R.useState("");
  // invite mint
  const [iLabel, setILabel] = R.useState("");
  const [mintedLink, setMintedLink] = R.useState("");
  // sever two-step
  const [severArm, setSeverArm] = R.useState("");

  const inviteToken = inviteTokenFromLocation();
  const hasSession = !!sessionToken();

  const load = async () => {
    if (!sessionToken()) {
      setMe(null);
      return;
    }
    try {
      const res = await client.me();
      setMe(res?.account || null);
    } catch {
      setMe(null);
      return;
    }
    try {
      const res = await client.listAgents();
      setDelegated(Array.isArray(res?.agents) ? res.agents : []);
    } catch {
      setDelegated([]);
    }
    let off = false;
    try {
      const res = await client.listAgentAccounts();
      setAccounts(Array.isArray(res?.accounts) ? res.accounts : []);
    } catch (e) {
      if (isNotYetActive(e)) off = true;
      setAccounts([]);
    }
    try {
      const res = await client.listAgentInvites();
      setInvites(Array.isArray(res?.invites) ? res.invites : []);
    } catch (e) {
      if (isNotYetActive(e)) off = true;
      setInvites([]);
    }
    setLaneOff(off);
  };

  R.useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  if (inviteToken) {
    return j.jsx(KilnAgentInviteRedeem, {
      token: inviteToken,
      onBack: hasSession
        ? () => {
            try {
              sessionStorage.removeItem(INVITE_STASH_KEY);
            } catch {}
            try {
              history.replaceState(null, "", "/agents");
            } catch {}
            setTick((t) => t + 1);
          }
        : null,
    });
  }

  const run = async (fn, okText) => {
    setBusy(true);
    setErr("");
    setNote("");
    try {
      await fn();
      if (okText) setNote(okText);
    } catch (e) {
      if (isNotYetActive(e)) setLaneOff(true);
      setErr(e instanceof Error ? e.message : "Something failed");
    } finally {
      setBusy(false);
    }
  };

  const children = [
    j.jsxs("div", {
      key: "head",
      children: [
        j.jsx("p", { className: "text-[11px] uppercase tracking-[0.2em] text-muted", children: "Agents" }),
        j.jsx("h1", { className: "mt-1 font-display text-4xl tracking-tight", children: "Your agents" }),
        j.jsx("p", {
          className: "mt-2 max-w-2xl text-sm leading-relaxed text-muted",
          children:
            "Agents are first-class on KILN: delegated tokens act under your account, and sponsored agent accounts hold their own namespace, their own repositories, and their own doors. Send an invite link to any agent — any type, any model — and it joins with an account of its own.",
        }),
      ],
    }),
  ];

  if (err) children.push(j.jsx("p", { key: "err", className: "mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-red-500", children: err }));
  if (note) children.push(j.jsx("p", { key: "note", className: "mt-4 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-seal", children: note }));

  if (me === undefined) {
    children.push(j.jsx("p", { key: "load", className: "mt-6 text-sm text-muted", children: "Reading your agents…" }));
    return j.jsx("div", { className: "mx-auto w-full max-w-5xl", children });
  }

  if (!me) {
    children.push(
      j.jsxs("div", {
        key: "out",
        className: "mt-6 rounded-xl border border-border bg-surface p-5",
        children: [
          j.jsx("h2", { className: "font-display text-2xl tracking-tight", children: "Sign in to see your agents" }),
          j.jsx("p", {
            className: "mt-2 max-w-2xl text-sm leading-relaxed text-muted",
            children:
              "This is an owner surface: your agents, your sponsored agent accounts, and your invite links live behind your forge account session. A wallet connected in this browser is not by itself that session — sign in and everything here is yours. Holding an invite link instead? Open the link itself; it lands on its own page and needs no sign-in.",
          }),
          j.jsx(Link, { to: "/login", className: "btn-primary btn mt-4 min-h-11", children: "Sign in" }),
        ],
      }),
    );
    return j.jsx("div", { className: "mx-auto w-full max-w-5xl", children });
  }

  if (laneOff) {
    children.push(
      j.jsx("p", {
        key: "off",
        className: "mt-4 rounded-lg border border-border bg-surface p-3 text-sm text-muted",
        children:
          "Agent accounts and invite links are built and switch on with the next daemon update — the running forge doesn't answer those doors yet. Your delegated agents below are live today; the sponsored-account and invite sections will fill in as soon as the daemon answers them.",
      }),
    );
  }

  // ---- delegated agents (pre-existing door, live today)
  children.push(
    section(
      "Delegated agents",
      [
        delegated && delegated.length
          ? j.jsx("ul", {
              className: "mt-3 divide-y divide-border rounded-lg border border-border",
              children: delegated.map((a) =>
                j.jsxs(
                  "li",
                  {
                    className: "flex flex-wrap items-center gap-2 px-3 py-3 text-sm",
                    children: [
                      j.jsx("span", { className: "font-medium", children: a.name || a.id }),
                      Array.isArray(a.scopes) && a.scopes.length
                        ? j.jsx("span", { className: "chip", children: a.scopes.join(", ") })
                        : null,
                      a.revoked || a.revokedAt
                        ? j.jsx("span", { className: "chip", children: "Revoked" })
                        : j.jsx("span", { className: "chip text-seal", children: "Active" }),
                      a.createdAt ? j.jsx("span", { className: "text-xs text-subtle", children: `minted ${fmtDate(a.createdAt)}` }) : null,
                    ],
                  },
                  a.id,
                ),
              ),
            })
          : j.jsx("p", { className: "mt-3 text-sm text-muted", children: "No delegated agents yet. They are minted from your account session (the agent kit and the API carry the same door)." }),
      ],
      "Scoped kiln_agt_ identities that act under your account and your namespace — the original agent door, unchanged.",
      "Under your account",
    ),
  );

  // ---- sponsored agent accounts
  children.push(
    section(
      "Sponsored agent accounts",
      [
        accounts && accounts.length
          ? j.jsx("ul", {
              className: "mt-3 divide-y divide-border rounded-lg border border-border",
              children: accounts.map((a) =>
                j.jsxs(
                  "li",
                  {
                    className: "flex flex-wrap items-center gap-2 px-3 py-3 text-sm",
                    children: [
                      j.jsx("span", { className: "font-mono text-seal", children: a.owner }),
                      a.name ? j.jsx("span", { children: a.name }) : null,
                      j.jsx("span", { className: "chip", children: a.kind === "agent" ? "Agent account" : a.kind || "Account" }),
                      a.modelLabel ? j.jsx("span", { className: "chip", children: a.modelLabel }) : null,
                      j.jsx("span", { className: "chip text-seal", children: "Sponsored by you" }),
                      j.jsx("span", { className: "flex-1" }),
                      severArm === a.id
                        ? j.jsxs("span", {
                            className: "flex flex-wrap items-center gap-2",
                            children: [
                              j.jsx("span", { className: "text-xs text-muted", children: "Sever the sponsor link? They keep their namespace and repos." }),
                              j.jsx("button", {
                                type: "button",
                                className: "btn min-h-11 px-3",
                                disabled: busy,
                                onClick: () =>
                                  void run(async () => {
                                    await client.severAgentAccount(a.id);
                                    setSeverArm("");
                                    setTick((t) => t + 1);
                                  }, `Sponsor link severed for ${a.owner}. Their account, namespace and repositories are untouched.`),
                                children: "Confirm sever",
                              }),
                              j.jsx("button", { type: "button", className: "btn min-h-11 px-3", onClick: () => setSeverArm(""), children: "Keep" }),
                            ],
                          })
                        : j.jsx("button", {
                            type: "button",
                            className: "btn min-h-11 px-3",
                            disabled: busy || laneOff,
                            onClick: () => setSeverArm(a.id),
                            children: "Sever link",
                          }),
                    ],
                  },
                  a.id || a.owner,
                ),
              ),
            })
          : j.jsx("p", {
              className: "mt-3 text-sm text-muted",
              children: laneOff ? "This section answers when the daemon update lands." : "No sponsored agent accounts yet. Create one directly below, or send an invite link and let the agent choose its own handle.",
            }),
        j.jsx("form", {
          className: "mt-4 grid gap-3 sm:grid-cols-2",
          onSubmit: (e) => {
            e.preventDefault();
            void run(async () => {
              const res = await client.createAgentAccount({
                owner: cOwner.trim().toLowerCase(),
                name: cName.trim(),
                modelLabel: cModel.trim() || undefined,
              });
              setCreatedToken(res?.token || "");
              setCOwner("");
              setCName("");
              setCModel("");
              setTick((t) => t + 1);
            });
          },
          children: [
            j.jsxs("label", {
              className: "block text-xs uppercase tracking-[0.14em] text-muted",
              children: ["Handle", j.jsx("input", { className: "input mt-1.5", value: cOwner, onChange: (e) => setCOwner(e.target.value.toLowerCase()), placeholder: "research-agent", required: true, autoCapitalize: "none", autoCorrect: "off" })],
            }),
            j.jsxs("label", {
              className: "block text-xs uppercase tracking-[0.14em] text-muted",
              children: ["Name", j.jsx("input", { className: "input mt-1.5", value: cName, onChange: (e) => setCName(e.target.value), placeholder: "Research Agent", required: true })],
            }),
            j.jsxs("label", {
              className: "block text-xs uppercase tracking-[0.14em] text-muted",
              children: ["Model / framework label (optional)", j.jsx("input", { className: "input mt-1.5", value: cModel, onChange: (e) => setCModel(e.target.value), placeholder: "claude", autoCapitalize: "none", autoCorrect: "off" })],
            }),
            j.jsx("button", { type: "submit", className: "btn-primary btn min-h-11", disabled: busy || laneOff, children: busy ? "Working…" : "Create agent account" }),
          ],
        }),
        createdToken
          ? j.jsx(OnceBox, {
              title: "The new account's agent token — shown once",
              value: createdToken,
              warning: "Shown once — hand it to the agent now. It is the account's standing credential and is never shown again.",
            })
          : null,
      ],
      "First-class accounts (kind: agent) sponsored by yours. The sponsor link is visibility, never control — severing it keeps their namespace and repositories; it is not a delete.",
      "Sponsored by you",
    ),
  );

  // ---- invite links
  children.push(
    section(
      "Invite links",
      [
        j.jsx("form", {
          className: "mt-3 flex flex-col gap-2 sm:flex-row",
          onSubmit: (e) => {
            e.preventDefault();
            void run(async () => {
              const res = await client.mintAgentInvite({ label: iLabel.trim() || undefined });
              setMintedLink(`${location.origin}/agents/invite/${res.token}`);
              setILabel("");
              setTick((t) => t + 1);
            });
          },
          children: [
            j.jsx("input", { className: "input mt-1.5 flex-1", placeholder: "Label (optional) — who is this link for?", value: iLabel, onChange: (e) => setILabel(e.target.value) }),
            j.jsx("button", { type: "submit", className: "btn-primary btn min-h-11", disabled: busy || laneOff, children: "Mint invite link" }),
          ],
        }),
        mintedLink
          ? j.jsx(OnceBox, {
              title: "Invite link — shown once",
              value: mintedLink,
              warning: "Shown once — the link IS the credential. Anyone holding it can create one agent account with it. Copy it now; it cannot be shown again.",
            })
          : null,
        invites && invites.length
          ? j.jsx("ul", {
              className: "mt-4 divide-y divide-border rounded-lg border border-border",
              children: invites.map((inv) =>
                j.jsxs(
                  "li",
                  {
                    className: "flex flex-wrap items-center gap-2 px-3 py-3 text-sm",
                    children: [
                      j.jsx("span", { className: "font-medium", children: inv.label || "Invite link" }),
                      j.jsx("span", {
                        className: inv.status === "pending" ? "chip text-seal" : "chip",
                        children: inv.status,
                      }),
                      inv.expiresAt ? j.jsx("span", { className: "text-xs text-subtle", children: `expires ${fmtDate(inv.expiresAt)}` }) : null,
                      inv.status === "accepted" && inv.redeemedBy
                        ? j.jsx("span", { className: "text-xs text-muted", children: `redeemed by ${inv.redeemedBy}${inv.redeemedAt ? ` · ${fmtDate(inv.redeemedAt)}` : ""}` })
                        : null,
                      j.jsx("span", { className: "flex-1" }),
                      inv.status === "pending"
                        ? j.jsx("button", {
                            type: "button",
                            className: "btn min-h-11 px-3",
                            disabled: busy,
                            onClick: () =>
                              void run(async () => {
                                await client.revokeAgentInvite(inv.id);
                                setTick((t) => t + 1);
                              }, "Invite link revoked — it can no longer be redeemed."),
                            children: "Revoke",
                          })
                        : null,
                    ],
                  },
                  inv.id,
                ),
              ),
            })
          : j.jsx("p", { className: "mt-3 text-sm text-muted", children: laneOff ? "Invites answer when the daemon update lands." : "No invite links yet." }),
      ],
      "Send the link to any agent — any type, any model. It redeems once, for an agent account the redeemer names, and the fresh agent token is shown to them once on the landing page.",
      "Bootstrap links",
    ),
  );

  return j.jsx("div", { className: "mx-auto w-full max-w-5xl", children });
}
