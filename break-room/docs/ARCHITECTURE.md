# Break Room — Architecture

## Overview
BYOK edge proxy that sits in front of OpenAI-compatible chat APIs and injects CBT anti-rumination prompts when an agent loops or panics.

## Core principle
Bring Your Own Key. The client supplies their own OpenRouter/OpenAI API key in the standard `Authorization: Bearer *** header. Break Room forwards it blind. Zero key storage. Zero compute risk.

## Components

```
Client
  -> example.com/agents/{license}/v1/chat/completions
  -> Break Room Worker
       -> KV lookup (license check)
       -> detectRumination() or detectPanic()
       -> inject CBT system prompt if needed
       -> forward to openrouter.ai/api/v1/chat/completions
       -> return response + X-BreakRoom-Intervention header
```

## Detection logic

### Rumination
- Looks at last 2 consecutive `assistant` messages
- If identical → flag
- Else if ≥90% similar (Levenshtein) → flag

### Panic
- Any message containing: `911`, `medical emergency`, `verification code`, `help me`, `emergency`

## Intervention
When triggered:
1. Prepend system prompt: "You appear to be repeating the same analysis without progress. Step back. Re-evaluate your core assumptions. What is the actual question you are trying to answer? State it clearly, then answer directly. Do not continue the loop."
2. Set header: `X-BreakRoom-Intervention: Rumination_Prevented` or `Panic_Detected`

## Endpoints

| Path | Method | Purpose |
|------|--------|---------|
| `/` | GET | Therapist homepage |
| `/agents` | GET | Break Room product page |
| `/agents/checkout` | POST | Create Stripe Checkout Session |
| `/agents/webhook/stripe` | POST | Stripe webhook → license in KV |
| `/webhook/stripe` | POST | Alt webhook path |
| `/agents/success` | GET | Success page showing license + proxy URL |
| `/agents/:license/v1/chat/completions` | POST | BYOK proxy + CBT interception |
| `/__test__/seed` | POST | Test KV seeding |

## Stripe flow
1. POST `/agents/checkout` with `{ "customerEmail": "you@test.com" }`
2. Redirect to Stripe Checkout
3. User pays (test card: 4242 4242 4242 4242)
4. Stripe fires `checkout.session.completed` to webhook
5. Worker verifies signature, generates `licenseKey`, writes to KV
6. User lands on `/agents/success?session_id=...`
7. Page reads license from KV by email, displays proxy URL

## Cost structure
- Cloudflare Workers: free tier (100k req/day)
- Cloudflare KV: free tier (1k reads + 1k writes/day)
- OpenRouter inference: user pays (BYOK)
- Stripe processing: 2.9% + 30¢ per transaction

## Gaps closed as of checkpoint 2
- CBT rumination detection ✅
- CBT panic keyword detection ✅
- Intervention proof header `X-BreakRoom-Intervention` ✅
- Stripe Checkout flow ✅
- Success page ✅
- BYOK architecture confirmed ✅

## Gaps remaining
- Live Stripe test-mode webhook fired from dashboard
- Live proxy test with real OpenRouter key from production domain
- Therapist copy on homepage (user task)
