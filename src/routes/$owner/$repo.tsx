import { createFileRoute, notFound } from "@tanstack/react-router";
import { isReservedOwnerName } from "@/lib/kiln/reserved";
import { RepoLayout } from "@/components/RepoChrome";

export const Route = createFileRoute("/$owner/$repo")({
  beforeLoad: ({ params }) => {
    // A reserved top-level name (settings, signin, …) is never an owner, even
    // when followed by another segment.
    if (isReservedOwnerName(params.owner)) throw notFound();
  },
  component: RepoLayout,
});
