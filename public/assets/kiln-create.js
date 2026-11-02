// KILN design round, Piece 3 (house module): the Create sheet.
//
// The app's single create entry. The bottom bar's center + button and the
// header New button both dispatch the `kiln:create` window event (the
// `kiln:palette` precedent in AppShell); this sheet answers it with one
// thumb-reach list of the app's REAL create doors — no nested menus.
//
// Doors (each verified to exist in the app today):
//   New repository    → /new?tab=create   (the repo create tab, Studio door)
//   Import from GitHub → /new?tab=import  (the import tab)
//   New gist          → /gists            (the gists surface's create flow)
//   New paper         → /papers#new       (the Papers Studio's new-paper door)
//   New workspace     → /workspaces?new=1 (the Workspaces surface's create
//                       form — added by the parity batch, G1, once the
//                       /workspaces surface existed; see NOTES-parity.md)

import { i as reactNs, t as React } from "./react-SIfiwpqq.js";
import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { t as FolderIcon } from "./folder-CuS7zSFG.js";
import { t as GitBranchIcon } from "./git-branch-cstK39mu.js";
import { t as TerminalIcon } from "./terminal-DUg4ppK_.js";
import { t as LayersIcon } from "./layers-QFN7Wm40.js";

const R = reactNs(React(), 1);
const j = jsxmod();

const DOORS = [
  {
    href: "/new?tab=create",
    icon: FolderIcon,
    label: "New repository",
    desc: "Start a repo on the forge — code, docs, anything.",
  },
  {
    href: "/new?tab=import",
    icon: GitBranchIcon,
    label: "Import from GitHub",
    desc: "Bring an existing GitHub repository into KILN.",
  },
  {
    href: "/gists",
    icon: TerminalIcon,
    label: "New gist",
    desc: "Publish a quick snippet or note.",
  },
  {
    href: "/papers#new",
    icon: LayersIcon,
    label: "New paper",
    desc: "Start a paper in the Papers Studio — released under its own KILN ID.",
  },
  {
    href: "/workspaces?new=1",
    icon: LayersIcon,
    label: "New workspace",
    desc: "Group the repos of one effort under a single name.",
  },
];

export function openCreateSheet() {
  try {
    window.dispatchEvent(new Event("kiln:create"));
  } catch {}
}

export function KilnCreateSheet() {
  const [open, setOpen] = R.useState(false);
  R.useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("kiln:create", onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("kiln:create", onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);
  if (!open) return null;
  const close = () => setOpen(false);
  return j.jsx("div", {
    className: "fixed inset-0 z-50 flex items-end justify-center",
    role: "dialog",
    "aria-modal": "true",
    "aria-label": "Create",
    children: [
      j.jsx("button", {
        key: "bd",
        type: "button",
        "aria-label": "Close",
        className: "absolute inset-0",
        style: { background: "rgba(0,0,0,0.6)" },
        onClick: close,
      }),
      j.jsx("div", {
        key: "panel",
        className:
          "relative w-full max-w-md overflow-auto border border-border bg-surface p-4 shadow-[var(--shadow-panel)]",
        style: {
          maxHeight: "85dvh",
          borderRadius: "1rem 1rem 0 0",
          paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
        },
        children: [
          j.jsxs("div", {
            key: "hd",
            className: "mb-2 flex items-center justify-between gap-3 px-1",
            children: [
              j.jsx("span", {
                key: "t",
                className: "font-display text-base font-semibold text-fg",
                children: "Create",
              }),
              j.jsx("button", {
                key: "x",
                type: "button",
                "aria-label": "Close",
                className:
                  "grid size-8 place-items-center rounded-full border border-border bg-surface-2 text-muted",
                onClick: close,
                children: "×",
              }),
            ],
          }),
          ...DOORS.map((d) =>
            j.jsxs("a", {
              key: d.href,
              href: d.href,
              onClick: close,
              className:
                "flex min-h-11 items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2",
              children: [
                j.jsx("span", {
                  key: "ic",
                  className:
                    "grid size-8 shrink-0 place-items-center rounded-lg border border-border bg-surface-2 text-seal",
                  children: j.jsx(d.icon, { className: "size-4" }),
                }),
                j.jsxs("span", {
                  key: "tx",
                  className: "min-w-0",
                  children: [
                    j.jsx("span", {
                      key: "l",
                      className: "block text-sm font-medium text-fg",
                      children: d.label,
                    }),
                    j.jsx("span", {
                      key: "d",
                      className: "block truncate text-xs text-muted",
                      children: d.desc,
                    }),
                  ],
                }),
              ],
            }),
          ),
        ],
      }),
    ],
  });
}
