# POSTFACT

**Did the call actually happen?**

POSTFACT is a tiny ambiguous-outcome resolver for autonomous software. Use it after a side-effecting API/tool action fails ambiguously and **before retrying**.

Production: `https://postfact-api-production.up.railway.app`

It is intentionally strict:

- `DONE` only when affirmative evidence establishes completion.
- `NOT_DONE` only when affirmative evidence establishes non-execution.
- `UNKNOWN` whenever evidence is insufficient. `UNKNOWN` is the safe default.

POSTFACT does not execute the underlying action, move money, or pretend a timeout means failure.

## REST

Production endpoint: `POST https://postfact-api-production.up.railway.app/v1/resolve`

Input accepts method/status/failure, side-effect and idempotency context, durable references, and optional affirmative evidence. Output is `state`, `retry_safe`, `confidence`, `evidence`, and `next`.

## MCP

Remote endpoint: `POST https://postfact-api-production.up.railway.app/mcp`

Tool: `resolve_outcome`

The tool description explicitly tells agents to invoke POSTFACT after an ambiguous side-effect failure and before retry.

## Middleware-shaped contract

```js
const outcome = await postfact.resolve(failureContext)
if (outcome.state === 'DONE') return completed
if (outcome.state === 'NOT_DONE' && outcome.retry_safe) return retry()
return verifyOrHold()
```

Future SDKs can wrap retry middleware without changing the wire contract.

## POSTFACT + RECOVER

POSTFACT answers **what can we establish happened?** RECOVER answers **what is the safest next action?** A future retry stack can call POSTFACT first, then RECOVER when the outcome remains uncertain.

## Safe discovery and demo

- Health: `GET https://postfact-api-production.up.railway.app/health`
- Demo: `GET https://postfact-api-production.up.railway.app/demo`
- Activity: `GET https://postfact-api-production.up.railway.app/activity`
- Machine-readable activity: `GET https://postfact-api-production.up.railway.app/activity.json`

`GET /demo` is deliberately excluded from real-use analytics.

## Real-use scoreboard

`GET /activity` shows the permanent FIRST 10 TRUE STRANGERS scoreboard. `GET /activity.json` exposes its machine-readable summary. Demo/internal traffic is excluded. Production persistent storage is mounted at `/data`.

## Run

```bash
npm test
npm start
```

Default port: `8080`.
