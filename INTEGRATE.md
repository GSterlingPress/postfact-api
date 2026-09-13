# Integrate POSTFACT

Resolve whether an ambiguous side-effecting action probably completed before software retries it.

## 30-second REST test

```bash
curl -s -X POST https://postfact-api-production.up.railway.app/v1/resolve \
  -H "content-type: application/json" \
  -d '{"method":"POST","status":504,"sideEffect":true,"idempotencyKey":false}'
```

## MCP

Remote Streamable HTTP endpoint:

```text
https://postfact-api-production.up.railway.app/mcp
```

Point any MCP client that supports remote Streamable HTTP servers at that URL. The server is designed for machine-to-machine calls and returns conservative decisions rather than inventing certainty.

## Production

- REST base: https://postfact-api-production.up.railway.app
- MCP: https://postfact-api-production.up.railway.app/mcp
- Health: https://postfact-api-production.up.railway.app/health
- Repository: https://github.com/GSterlingPress/postfact-api

## Good integration points

Call POSTFACT inside retry middleware, agent tool wrappers, workflow engines, job runners, or backend orchestration immediately before the expensive or risky decision it is meant to improve.

Keep the call optional and fail safe: if POSTFACT is unreachable, your application should fall back to its existing behavior rather than treat an unavailable advisory service as proof of anything.
