import { t as jsxmod } from "./jsx-runtime-0vZSBttN.js";
import { GithubExplorer } from "./explore-github.js";
import { component as KilnExplore } from "./explore-list.js";

const j = jsxmod();

function ExplorePage() {
  return j.jsxs("div", {
    children: [
      j.jsx(GithubExplorer, {}),
      j.jsx("div", { className: "mt-10", children: j.jsx(KilnExplore, {}) }),
    ],
  });
}

export { ExplorePage as component };
