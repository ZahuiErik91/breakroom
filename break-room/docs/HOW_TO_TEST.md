# Break Room — How To Test

## Free local test (no Stripe, no payments)

Use the local standalone server included in this repo. It mirrors the worker behavior exactly, but uses in-memory storage.

### Start the local server

```bash
cd <project-root>/break-room
python3 local-server.py
```

### Test the proxy

```bash
curl -X POST http://localhost:9876/v1/chat/completions   -H "Content-Type: application/json"   -H "Authorization: Bearer YOUR_OPENROUTER_KEY"   -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "ping"},
      {"role": "assistant", "content": "Pong. How can I assist you today?"},
      {"role": "user", "content": "Again."},
      {"role": "assistant", "content": "Pong. How can I assist you today?"}
    ]
  }'
```

Look for header: `X-BreakRoom-Intervention: Rumination_Prevented`

### Detect panic

```bash
curl -X POST http://localhost:9876/v1/chat/completions   -H "Content-Type: application/json"   -H "Authorization: Bearer YOUR_OPENROUTER_KEY"   -d '{
    "model": "openai/gpt-4o-mini",
    "messages": [
      {"role": "user", "content": "Emergency! Help me!"}
    ]
  }'
```

Look for header: `X-BreakRoom-Intervention: Panic_Detected`

## Production test (requires Stripe test mode)

1. Go to https://dashboard.stripe.com/test/webhooks
2. Set endpoint to `https://example.com/agents/webhook/stripe`
3. Send test event: `checkout.session.completed`
4. Check production KV for new license key
5. Call proxy with that license + your OpenRouter key
