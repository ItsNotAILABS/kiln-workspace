import { Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";

/**
 * Default 404 — renders for unknown paths and for routes that throw
 * `notFound()` (e.g. reserved names hitting the /$owner dynamic route).
 * Offers recovery instead of a bare framework message.
 */
export function AppNotFoundComponent() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <span className="text-subtle" aria-hidden="true">
        <Compass className="size-10" strokeWidth={1.5} />
      </span>
      <h1 className="mt-4 font-display text-4xl">Not found</h1>
      <p className="mt-3 text-sm text-muted">
        Nothing lives at this address. It may have been renamed, or the link is wrong.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link to="/" className="btn h-9">
          Home
        </Link>
        <Link to="/explore" search={{ q: "" }} className="btn h-9">
          Explore repositories
        </Link>
        <Link to="/search" search={{ q: "", type: "repos" }} className="btn h-9">
          Search
        </Link>
      </div>
    </main>
  );
}
