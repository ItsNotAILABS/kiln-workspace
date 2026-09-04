import { b as store } from "./store-sx46DNi5.js";

const VLAPTOP_ID = "itsnotailabs/vlaptop";

function ensure() {
  const s = store.getState?.();
  if (!s || typeof s.connect !== "function") return false;
  if (!s.wallet) {
    try { s.connect("itsnotailabs"); } catch {}
  }
  const st = store.getState();
  const agents = st.agents || [];
  if (!agents.some((a) => a.repoId === VLAPTOP_ID)) {
    store.setState({
      agents: [
        { id: "agent_indra_vlaptop", repoId: VLAPTOP_ID, name: "Indra", role: "indexer", resident: true, modelId: "grok-4.6" },
        ...agents,
      ],
    });
  }
  const domains = st.domains || [];
  if (!domains.some((d) => d.repoId === VLAPTOP_ID)) {
    store.setState({
      domains: [
        { id: "dom_itsnotailabs-vlaptop", repoId: VLAPTOP_ID, host: "itsnotailabs-vlaptop.kiln.app", kind: "kiln", status: "live", https: true, createdAt: "2026-09-03T00:00:53Z" },
        ...domains,
      ],
    });
  }
  const issues = st.userIssues || [];
  if (!issues.some((i) => i.repoId === VLAPTOP_ID)) {
    store.setState({
      userIssues: [
        { id: VLAPTOP_ID + "#1", number: 1, repoId: VLAPTOP_ID, title: "SCREEN-KERNEL/1.1 verb table as the public contract", state: "open", author: "itsnotailabs", createdAt: "2026-09-03T00:00:53Z" },
        ...issues,
      ],
    });
  }
  try {
    if ((store.getState().balance || 0) < 2500) store.setState({ balance: 2500 });
  } catch {}
  return true;
}

let n = 0;
const t = setInterval(() => {
  n += 1;
  if (ensure() || n > 50) clearInterval(t);
}, 250);
