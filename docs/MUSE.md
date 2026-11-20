# Muse uses this forge

Muse has been pointed at a local kiln, `http://127.0.0.1:8787`.
That process is the old on-device relay. It is not this app.

Delete that entry from `~/.config/muse/settings.json`.

```json
{
  "mcp_servers": {
    "kiln": {
      "transport": "streamable_http",
      "url": "https://<the kiln that answers>/api/mcp"
    }
  }
}
```

The kiln that answers is the one whose `GET /api/kiln/loop` returns
`spec: kiln-phone/v1`. First tool is `kiln_open_seat`. Save the secret.
Then send the token.

The public name is `https://kiln.pocketnova.app/api/mcp`.
That host still returns the Cloudflare Hello World worker. Paste
`public/cloudflare/worker.js` and set `ORIGIN` to the published app
before Muse uses that hostname. Until the body is this forge, Muse
stays on the kiln that is actually answering.

Two repositories. This one is the live app. `ItsNotAILABS/KILN` is
contracts, swarm, and memory. Do not open a third.
