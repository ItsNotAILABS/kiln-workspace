/**
 * Docker nav door — one "Docker" anchor to the operator console (/docker/),
 * inserted into the app nav when a nav container shows up.
 *
 * Fully self-contained and defensive by design: the whole file is wrapped
 * so it can never throw into the app, it polls briefly for the nav (the
 * shell mounts after this module evaluates), inserts at most ONE anchor,
 * and otherwise does nothing at all. It carries no state and no data —
 * the console itself is gated on the operator token.
 */
try {
  const HREF = "/docker/";
  const MARK = "kiln-docker-nav-link";
  let done = false;
  let tries = 0;

  function findNav() {
    // Prefer the header's own nav (the app chrome kiln-forge.js arms).
    const headerNav = document.querySelector("header nav");
    if (headerNav) return headerNav;
    // Fall back to the fixed bottom tab bar: the container kiln-forge.js
    // finds by walking up from the /wallet anchor to a fixed ancestor.
    const wa = document.querySelector('a[href="/wallet"]');
    let n = wa;
    while (n && n !== document.body) {
      if (n.tagName === "NAV") return n;
      try {
        if (getComputedStyle(n).position === "fixed") return n;
      } catch {
        /* getComputedStyle is best-effort here */
      }
      n = n.parentElement;
    }
    return document.querySelector("nav");
  }

  function insert() {
    if (done) return true;
    const nav = findNav();
    if (!nav) return false;
    if (nav.querySelector(`a[href="${HREF}"]`) || nav.querySelector(`.${MARK}`)) {
      done = true;
      return true;
    }
    const sibling = nav.querySelector("a[href]");
    const a = document.createElement("a");
    a.href = HREF;
    a.textContent = "Docker";
    a.className = ((sibling && sibling.getAttribute("class")) || "") + " " + MARK;
    a.setAttribute("data-kiln-docker-nav", "1");
    nav.appendChild(a);
    done = true;
    return true;
  }

  if (!insert()) {
    const iv = setInterval(() => {
      tries += 1;
      if (insert() || tries >= 40) clearInterval(iv);
    }, 500);
  }
} catch {
  /* the nav door is an enhancement; silence is the correct failure mode */
}
