import { createFileRoute } from "@tanstack/react-router";
import { formatKln } from "@/lib/utils";
import { useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/wallet")({ component: WalletPage });

function WalletPage() {
  const kiln = useKiln();
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-4xl">Wallet</h1>
      <div className="panel mt-6 p-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Balance</p>
        <p className="mt-2 font-display text-5xl tabular-nums">{formatKln(kiln.balance)}</p>
        <p className="mt-3 font-mono text-xs text-muted">{kiln.wallet?.address ?? "disconnected"}</p>
        <button type="button" className="btn mt-4 h-9" onClick={() => useKiln.setState({ balance: kiln.balance + 250 })}>
          Faucet 250 KLN
        </button>
        <p className="mt-2 text-[11px] text-subtle">Demo wallet — the faucet mints local play KLN, not on-chain funds.</p>
      </div>
    </div>
  );
}
