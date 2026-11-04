# Docker in KILN

Real Docker support for the KILN app: an operator console that drives the
host's actual Docker engine — build images from forge repositories, run
containers, read logs, tear down — with every surface gated on the
operator token.

- Engine: `scripts/docker-engine.mjs` (zero-dependency; drives the real
  `docker` CLI via `execFile`/`spawn` with argument arrays, never shell
  strings; binary is `KILN_DOCKER_BIN` or `docker` on PATH)
- Routes: `scripts/serve-original.mjs`, answered locally before the
  generic `/api/kiln` block
- Console: `public/docker/index.html` (standalone page at `/docker/`),
  reached from the app nav via `public/assets/kiln-docker-nav.js`

## The operator-token gate

Every `/api/kiln/docker/*` route — reads included — first passes
`authorizeDocker`: a constant-time (`crypto.timingSafeEqual`) Bearer
comparison against `~/.kiln-swarm/api.token`, the same token the forge
daemon trusts. There is no account-session path and no anonymous path.

- Missing/mismatched token → `401 {"ok":false,"error":"docker console requires the operator token"}`
- Missing token file → the same 401 (the gate fails closed)
- The token is never logged, never returned, and never appears in the
  page. The console keeps it in the tab's `sessionStorage` only and
  sends it as an `Authorization` header; "Forget token" clears it.

This is deliberately stricter than the forge-activity mirror, which
reads with the token server-side: the Docker console can start and
destroy workloads on the host, so the credential travels with the
request and nothing is proxied on a visitor's behalf.

## Endpoints

All responses are JSON with `cache-control: no-store`. Errors are
`{ok:false, error, code?}` where `error` is the docker CLI's own stderr,
trimmed — no stack traces.

| Method | Route | Body / query | Answers |
| --- | --- | --- | --- |
| GET | `/api/kiln/docker/status` | — | engine probe (versions, storage driver, OS/arch) + image/container counts |
| GET | `/api/kiln/docker/images` | — | images: id, repository, tag, size, createdAt |
| GET | `/api/kiln/docker/containers` | — | containers (all): id, name, image, state, status, ports, labels |
| GET | `/api/kiln/docker/containers/:id` | — | inspect: state, ports, labels, env key names (never values) |
| GET | `/api/kiln/docker/containers/:id/logs` | `?tail=` (1–5000, default 200) | combined stdout+stderr, capped at 64 KiB |
| POST | `/api/kiln/docker/build` | `{owner, repo, ref?, tag?, dockerfile?}` | `202 {jobId}`; the build runs async in-process |
| GET | `/api/kiln/docker/jobs/:id` | — | job state (`queued`/`building`/`done`/`failed`), error, last 100 log lines |
| POST | `/api/kiln/docker/run` | `{image, name?, ports?, env?, memoryMb?, cpus?, network?, cmd?}` | `200 {container:{id, image}}` |
| POST | `/api/kiln/docker/containers/:id/start` | — | `{id, state:"started"}` |
| POST | `/api/kiln/docker/containers/:id/stop` | — | `{id, state:"stopped"}` |
| POST | `/api/kiln/docker/containers/:id/restart` | — | `{id, state:"restarted"}` |
| DELETE | `/api/kiln/docker/containers/:id` | `?force=1` | `{id, removed:true}` |

Validation is strict and happens before any CLI call: owner/repo use
serve-original's own public-route regexes (`^[a-z0-9][a-z0-9-]{0,38}$`,
`^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$`), container ids/names, image refs,
port mappings (`^\d{1,5}:\d{1,5}$`, each side 1–65535), env keys
(`^[A-Za-z_][A-Za-z0-9_]*$`), memory 16–65536 MB, cpus in (0, 64].
Bad input is a 400 with the reason; a missing engine is a 503; a
missing repo/Dockerfile/container is a 404.

## Run defaults

`POST /run` starts containers detached with, always:

- `--label kiln.managed=1` (builds carry the same label)
- `--cap-drop ALL` — no Linux capabilities
- `--security-opt no-new-privileges`
- `--memory <memoryMb>m` / `--cpus <cpus>` when given

Nothing widens these defaults: there is no privileged mode, no volume
mount surface, and no way to pass arbitrary `docker` flags — the request
body is a closed shape, not a command line.

## Build from a forge repo

1. `POST /build {owner, repo, ref?}` — `ref` defaults to `HEAD`.
2. The engine materializes the repo from the forge's own bare store,
   `git --git-dir ~/.kiln-swarm/git/<owner>/<repo>.git archive <ref>`,
   into a fresh temp dir. The bare repo must exist; path escapes are
   rejected before git runs.
3. A Dockerfile must exist at the repo root, or at the confined
   relative `dockerfile` path in the request — otherwise the job fails
   with a typed `NO_DOCKERFILE` error before any build starts.
4. `docker build` streams its output into the job's log ring buffer
   (capped at 500 lines; the job endpoint serves the last 100).
5. The temp dir is removed when the job settles, whatever the outcome.
   The default tag is `kiln/<repo>:latest`.

## Honest limits

- **Jobs are in-memory.** Build state and logs live in the backend
  process; a restart loses them (`GET /jobs/:id` then 404s, and says
  why). Images and containers themselves are the engine's, and persist
  exactly as Docker persists them.
- **One backend, one engine.** The console drives the Docker daemon on
  the host the backend runs on. There is no remote-engine support.
- **Networking is the host's.** Container networking, DNS and egress
  follow the host's dockerd configuration and the network named in the
  run request; KILN adds no NAT, proxy or firewall layer of its own.
- **No registry surface.** Nothing here pulls, pushes or logs into a
  registry; images appear by building them (or by whatever the host's
  operator does outside KILN).
- **Probe honesty.** If the CLI is missing or the daemon is down,
  `probe()` answers `{available:false, reason}` with the CLI's own
  words, the status route reports counts as null, and the console shows
  its unavailable panel instead of empty tables.
