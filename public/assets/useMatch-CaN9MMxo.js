import { t as useRouter } from "./useRouter-CcIDS3PN.js";
import { t as useStore } from "./useStore-DLa1jts-.js";
function sel(opts) {
  return opts && typeof opts.select == "function" ? opts.select : (s) => s;
}
export function t(opts = {}) {
  const router = useRouter();
  const store = router?.stores?.__store || router?.store;
  if (!store)
    return sel(opts)({
      params: {},
      search: {},
      matches: [],
      location: { pathname: typeof location < "u" ? location.pathname : "" },
    });
  return useStore(store, (s) => {
    const matches = s.matches || [];
    const loc = s.location || { pathname: typeof location < "u" ? location.pathname : "" };
    const last = matches[matches.length - 1] || {};
    const packed = {
      ...s,
      ...last,
      params: last.params || s.params || {},
      search: last.search || s.search || {},
      location: loc,
      matches,
      loaderData: last.loaderData,
      loaderDeps: last.loaderDeps,
      context: last.context || s.context,
    };
    return sel(opts)(packed);
  });
}
export function n(opts) {
  return sel(opts);
}
