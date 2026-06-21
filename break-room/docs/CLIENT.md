# Break Room — Client Integration

Agent integration surface for Break Room.

Endpoints are served from the same origin as the live site. All references below use host-relative paths.

## Proxy endpoint

POST `/agents/webhook/stripe` is reserved for Stripe. Client integration only needs this completion endpoint:

- POST `/agents/{license}/v1/chat/completions`
- Auth: `Authorization: Bearer <OPENROUTER_KEY>`
- Body: same as OpenAI chat completions

One URL swap replaces OpenRouter with Break Room.
