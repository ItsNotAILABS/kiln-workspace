import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { formatKln } from "@/lib/utils";
import { useKiln } from "@/lib/kiln/store";

export const Route = createFileRoute("/account")({ component: Account });

function Account() {
  const kiln = useKiln();
  const [handle, setHandle] = useState(kiln.wallet?.handle ?? "you");
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="font-display text-4xl">Profile</h1>
      {kiln.wallet ? (
        <div className="panel mt-6 space-y-3 p-5">
          <p className="font-mono">{kiln.wallet.handle}</p>
          <p className="font-mono text-xs text-muted">{kiln.wallet.address}</p>
          <p className="tabular-nums">{formatKln(kiln.balance)}</p>
          <Link to="/$owner" params={{ owner: kiln.wallet.handle }} search={{ tab: "overview" }} className="btn h-9">
            View profile
          </Link>
          <button type="button" className="btn h-9" onClick={() => kiln.disconnect()}>
            Disconnect
          </button>
        </div>
      ) : (
        <form
          className="panel mt-6 space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            kiln.connect(handle);
          }}
        >
          <input className="input" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="handle" />
          <button type="submit" className="btn-primary btn h-9">
            Connect
          </button>
        </form>
      )}
    </div>
  );
}
