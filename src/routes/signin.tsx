import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * /signin — the forge's account door lives at /join (signup + sign-in
 * against the daemon's account system, with the onboarding walk at
 * /welcome after it).
 *
 * This route exists so the name can never be claimed as a username by the
 * /$owner dynamic route (see src/lib/kiln/reserved.ts).
 */
export const Route = createFileRoute("/signin")({
  beforeLoad: () => {
    throw redirect({ to: "/join" });
  },
  component: () => null,
});
