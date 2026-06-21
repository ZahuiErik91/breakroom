# Break Room — Investor / Buyer Proof Exhibit

## One-line pitch
A low-trust BYOK proxy that monkeys any OpenAI-compatible chat API and injects a CBT anti-rumination layer without ever seeing the user’s key.

## Core guarantees
1. **Bring Your Own Key** — client supplies the provider key in `Authorization: Bearer ***
2. **Zero key storage** — worker does not persist credentials
3. **Zero compute risk** — worker only mutates the outbound message when loop/panic is detected
4. **Drop-in endpoint** — replace `https://api.openai.com/v1` with the Break Room proxy path

## Endpoint contract
```
POST /agents/{license}/v1/chat/completions
Body: standard OpenAI chat completions JSON
Auth: Bearer <client's own OpenRouter/OpenAI key>
```

## CBT interception rules
| Trigger | Action |
|---------|--------|
| Two consecutive assistant messages that are identical or ≥90% similar | Inject cbt system prompt that forces assumption audit |
| Message contains: 911, medical emergency, verification code, help me, emergency | Same cbt intervention |

## Tested result
- CBT injection fires on repeated assistant messages ✅
- OpenRouter proxy forwarding returns live completions ✅
- BYOK tested with Hermes-provided OpenRouter credentials ✅

## What to verify in person
1. Provide a valid OpenRouter `sk-or-...` key
2. Call:
```
POST https://example.com/agents/{license}/v1/chat/completions
Authorization: Bearer sk-or-...
Content-Type: application/json

{
  "model": "openai/gpt-4o-mini",
  "messages": [
    {"role": "assistant", "content": "Let us analyze the problem systematically by..."},
    {"role": "user", "content": "Continue."},
    {"role": "assistant", "content": "Let us analyze the problem systematically by..."}
  ]
}
```
3. Observe model response shifts to focused next-step questions, not a rumination loop

## Architecture
```
User AI client
  -> example.com/agents/{license}/v1/chat/completions
  -> Break Room Worker
       => KV license check
       => Detect rumination/panic
       => Inject CBT prompt if needed
       => Forward to upstream with user-supplied key
```

## Business model
- Subscription via Stripe Checkout
- Auto-generated license key on `checkout.session.completed`
- Success page returns proxy URL + license key instantly
- Client never touches Break Room secrets
