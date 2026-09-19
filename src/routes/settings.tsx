import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /settings — global account settings live on /account (handle, address,
 * connect/disconnect); per-repository settings live on /$owner/$repo/settings.
 *
 * This route exists so the name can never be claimed as a username by the
 * /$owner dynamic route (see src/lib/kiln/reserved.ts).
 */
export const Route = createFileRoute("/settings")({
  beforeLoad: () => {
    throw redirect({ to: "/account" });
  },
  component: () => null,
});
