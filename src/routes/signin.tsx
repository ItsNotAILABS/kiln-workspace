import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /signin — KILN has no password sign-in. Identity is the connected wallet,
 * managed on /account (AppShell auto-connects a handle on first visit).
 *
 * This route exists so the name can never be claimed as a username by the
 * /$owner dynamic route (see src/lib/kiln/reserved.ts).
 */
export const Route = createFileRoute("/signin")({
  beforeLoad: () => {
    throw redirect({ to: "/account" });
  },
  component: () => null,
});
