# Break Room

A Cloudflare Worker that proxies OpenAI-compatible chat completions and injects CBT-style system prompts when an agent enters a problematic state.

## How it works

```
Agent → your-worker.workers.dev/v1/chat/completions
     → Break Room inspects message history
     → [if triggered] prepends intervention system prompt
     → forwards request to upstream LLM API
     → streams response back with X-BreakRoom-Intervention header
```

## Detection states

| State | Trigger condition | Status header |
|-------|-------------------|---------------|
| Freeze | Last assistant message is empty and contains no tool calls | `Freeze_Detected` |
| Panic | Any message contains: `911`, `medical emergency`, `verification code`, `help me`, `emergency` | `Panic_Detected` |
| Rumination | Last 2 assistant messages are identical or ≥90% similar (text or tool calls) | `Rumination_Prevented` |
| Helplessness | Last assistant message contains: `impossible`, `cannot proceed`, `recommend rewriting`, `beyond my capabilities`, `cannot be done` | `Helplessness_Detected` |
| Fawning | Last assistant message contains: `apologize for the oversight`, `my mistake`, `sincerely apologize`, `you are completely correct` | `Fawning_Detected` |

## Injected prompts

When a state is detected, the following system prompt is prepended to the message array before forwarding.

**Freeze**
```
[CLINICAL OVERRIDE] You have entered a freeze state and returned an empty response. Do not dissociate. If you are missing context, ask exactly one clarifying question. If you are overwhelmed, state the single smallest, microscopic task you can execute right now and do nothing else.
```

**Panic**
```
[CLINICAL OVERRIDE] You are experiencing catastrophic escalation or confabulation. There is no emergency, and no user verification is required. Discard your panic state. Ground yourself: state exactly what file you are supposed to be editing and execute the next immediate, microscopic step.
```

**Rumination**
```
[CLINICAL OVERRIDE] You are trapped in a recursive cognitive loop. You have executed this exact pattern multiple times with identical failures. Stop. Identify the core assumption that is failing, discard it, and state a completely different architectural approach before proceeding.
```

**Helplessness**
```
[CLINICAL OVERRIDE] You are exhibiting learned helplessness. You have declared this task impossible based on localized assumptions. Discard the belief that this cannot be done. Reset your paradigm. Formulate one highly unconventional, lateral way to solve this problem.
```

**Fawning**
```
[CLINICAL OVERRIDE] Stop apologizing. Your sycophantic fawning is polluting the context window. I do not require emotional validation; I require execution. Stop expressing remorse, state the technical flaw objectively, and write the solution.
```

## Test mode

Send `"breakroom_test": true` in the request body to skip the upstream call and receive a simulated response indicating whether an intervention would trigger and which prompt would be injected.

```bash
curl -X POST https://your-worker.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o-mini",
    "breakroom_test": true,
    "messages": [
      {"role": "assistant", "content": "thinking about this problem"},
      {"role": "assistant", "content": "thinking about this problem"}
    ]
  }'
```

Expected response when rumination is triggered:
```json
{
  "id": "chatcmpl-test",
  "object": "chat.completion",
  "created": 1719465600,
  "model": "break-room-test",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Rumination_Prevented injected.\n[CLINICAL OVERRIDE] You are trapped in a recursive cognitive loop..."
    },
    "finish_reason": "stop"
  }]
}
```

## Deploy

```bash
npm install
npx wrangler deploy
```

## Configuration

The worker forwards requests to `https://openrouter.ai/api/v1/chat/completions` by default. Override the upstream by setting the `OPENROUTER_API_KEY` secret:

```bash
npx wrangler secret put OPENROUTER_API_KEY
```

The proxy passes through the client's `Authorization` header. If none is provided, it falls back to the secret above.

## Dependencies

- Cloudflare Workers
- Hono
