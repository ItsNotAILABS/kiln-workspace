import { createFileRoute } from "@tanstack/react-router";
import { RepoLayout } from "@/components/RepoChrome";

export const Route = createFileRoute("/$owner/$repo")({
  component: RepoLayout,
});
