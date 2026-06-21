# Break Room

A Cloudflare Worker + local CLI that turns any OpenAI-compatible client into a therapist-aware, rumination-intercepting proxy.

## What this repo shows

- **`break-room/`** – worker-side runtime config + docs (packaging, schema, test notes)
- **`break-room-cli/`** – local setup CLI that patches `.env` / config files to point agents at the proxy

The worker source is not included in this public snapshot; this repo is for transparency around the *packaging and client setup*.

---

## Architecture (high level)

```
Client (Hermes / Cursor / LiteLLM / AutoGen)
    │
    ▼  base_url rewritten to Break Room proxy
Worker route /:license/v1/chat/completions
    │
    ├── KV license gate
    ├── Rumination / panic detection
    └── Forward to upstream LLM provider
```

## Client setup

Run the local CLI:

```bash
npx breakroom
```

It edits only `OPENAI_BASE_URL` / `ANTHROPIC_BASE_URL` in your local config files. Models, temperatures, and other settings are never touched.

## Docs

- `break-room/docs/ARCHITECTURE.md` – how the pieces connect
- `break-room/docs/CLIENT.md` – client integration notes
- `break-room/docs/HOW_TO_TEST.md` – local dev checklist
- `break-room/docs/E2E_TEST.md` – end-to-end flow
- `break-room/docs/PITCH.md` – product narrative

## Privacy / secrets

- No API keys, tokens, or live URLs are stored in this repo.
- Worker secrets and Stripe webhook signing keys are set via `wrangler secret put` and never committed.
- The local CLI only ever rewrites proxy URLs on the developer’s machine.

## Tech stack

Cloudflare Workers (nodejs_compat), Hono, Stripe Checkout, Cloudflare KV, OpenAI-compatible API layer.
