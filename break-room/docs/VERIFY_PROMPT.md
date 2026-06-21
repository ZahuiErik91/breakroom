# Break Room — Checkout Verification Cookicutter

Use this exact prompt with any AI / coding session when verifying the live Stripe + BYOK checkout flow on `https://example.com`.

---

## Prompt
Break Room worker is already live at `https://example.com`. Do NOT deploy anything. Verify the money loop end-to-end using curl only.

Steps:
1. Trigger a test-mode `checkout.session.completed` webhook from the Stripe dashboard to `https://example.com/agents/webhook/stripe`
2. Read the returned `licenseKey`
3. Call `POST https://example.com/agents/{licenseKey}/v1/chat/completions` with a real OpenRouter API key in the `Authorization` header
4. Confirm you get a real model completion back
5. Trigger CBT injection by sending two near-identical assistant messages in the message history and confirm the response behavior changes
6. Report exact curl commands and HTTP status codes for each step

Relevant files:
- `<project-root>/break-room/src/index.ts`
- `<project-root>/break-room/wrangler.toml`
- `<project-root>/break-room/docs/E2E_TEST.md`
