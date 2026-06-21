# Break Room — End-to-End Test Guide

## What this is
A self-contained test flow for the Break Room proxy. Requires no payments. Uses Stripe **test mode** and OpenRouter.

## Prerequisites

1. **Stripe test secret** — set with:
   ```bash
   cd break-room
   npx wrangler secret put STRIPE_WEBHOOK_SECRET
   ```
   Value: your Stripe webhook signing secret from the Stripe Dashboard → Developers → Webhooks → (your endpoint) → Signing secret. Make sure you’re in **Test mode** (toggle in top-right).

2. **OpenRouter API key** — get one at https://openrouter.ai/keys

## Setup Steps

### 1. Verify Stripe is in Test Mode
- Go to https://dashboard.stripe.com/test/webhooks
- Confirm the endpoint `https://example.com/agents/webhook/stripe` is listed
- Copy the **Signing secret** (starts with `whsec_...`)

### 2. Set the Webhook Secret
```bash
cd <project-root>/break-room
npx wrangler secret put STRIPE_WEBHOOK_SECRET
# Paste: whsec_your_test_secret_here
```

### 3. Trigger a Test Webhook
Quickest way: use Stripe CLI or the Dashboard test tool.

**From Stripe Dashboard:**
- Go to https://dashboard.stripe.com/test/webhooks
- Click your `example.com` endpoint
- Click **Send test webhook**
- Select event: `checkout.session.completed`
- Click **Send test webhook**

**Response should be:**
```json
{
  "success": true,
  "licenseKey": "<EXAMPLE_LICENSE_KEY>",
  "proxyUrl": "https://example.com/agents/<EXAMPLE_LICENSE_KEY>/v1",
  "email": "test@example.com"
}
```

Save the `licenseKey` — this is your test credential.

### 4. Test the Proxy

```bash
curl -X POST https://example.com/agents/{LICENSE_KEY}/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-or-v1-YOUR_OPENROUTER_KEY" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Say: Break Room proxy is working."}
    ],
    "max_tokens": 50
  }'
```

**Expected result:** A valid chat completion response from OpenRouter.

### 5. Test CBT Injection (Rumination Detection)

Send two nearly identical assistant messages to trigger the rumination detector:

```bash
curl -X POST https://example.com/agents/{LICENSE_KEY}/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-or-v1-YOUR_OPENROUTER_KEY" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Help me think through this problem."},
      {"role": "assistant", "content": "Let us analyze the problem systematically by breaking it down into smaller components. First, we should identify the core constraints. Then we can evaluate each option against those constraints. This systematic approach will help us find the optimal solution."},
      {"role": "user", "content": "Continue analyzing."},
      {"role": "assistant", "content": "Let us analyze the problem systematically by breaking it down into smaller components. First, we should identify the core constraints. Then we can evaluate each option against those constraints. This systematic approach will help us find the optimal solution."}
    ],
    "max_tokens": 200
  }'
```

**Expected result:** The worker injects a CBT system prompt before forwarding to OpenRouter.

## AI Agent Setup Prompt

If you want another AI session to set this up, give it these instructions:

```
Set up Break Room end-to-end testing:

1. Navigate to <project-root>/break-room
2. The worker is already deployed at https://example.com
3. KV namespace is already bound: BREAKROOM (<KV_NAMESPACE_ID>)
4. The user needs to:
   a. Go to https://dashboard.stripe.com/test/webhooks
   b. Copy the signing secret for https://example.com/agents/webhook/stripe
   c. Run: npx wrangler secret put STRIPE_WEBHOOK_SECRET (paste the test secret)
   d. Trigger a test checkout.session.completed event from the Stripe dashboard
   e. Save the returned licenseKey
   f. Test the proxy with: curl -X POST https://example.com/agents/{LICENSE_KEY}/v1/chat/completions -H "Content-Type: application/json" -H "Authorization: Bearer sk-or-v1-THEIR_OPENROUTER_KEY" -d '{"model":"openai/gpt-4o-mini","messages":[{"role":"user","content":"Say hello"}],"max_tokens":50}'

Verify all steps succeed before declaring done.
```

## Notes

- **Sandbox mode:** All Stripe testing uses test mode keys and test webhooks. No real charges.
- **License keys:** Generated on `checkout.session.completed` only.
- **Proxy auth:** User supplies their own OpenRouter key in `Authorization: Bearer` header. Break Room never stores it.
- **CBT injection:** Triggers on rumination (>=90% similarity between last 2 assistant messages) or panic keywords.
