# Domain (later — not this step)

**Wanted:** `https://kiln.medinatechlabs.net` (same lab as Pocket).

**Now:** keep https://kiln-git.grok.me/ as the live site.

**When workspace is true (this repo on GitHub, Codex + Grok on separate branches):**

1. `npm run build` on `main` must succeed.
2. Cloudflare named tunnel (same pattern as Pocket `:8787`) → local `:8080` **or** Pages/Workers from `main`.
3. Do not steal `pocket.medinatechlabs.net` — that is PhoneAI.
4. TLS only via Cloudflare. No raw `:8080` on the public hostname.

Until then, do not change DNS.
