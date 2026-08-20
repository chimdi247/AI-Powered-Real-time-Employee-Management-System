# Rate Limiting & Throttling

## Goal

Implement in-memory rate limiting middleware to prevent API abuse and ensure fair usage. No external dependencies — use a simple Map-based store with automatic cleanup.

## Architecture

### New Middleware: `backend/src/middlewares/rateLimit.ts`

A configurable rate limiter factory function:

```ts
interface RateLimitConfig {
  windowMs: number;     // Time window in milliseconds
  max: number;          // Max requests per window
  keyGenerator?: (req: Request) => string;  // Default: req.ip
  message?: string;     // Custom error message
}

function rateLimit(config: RateLimitConfig): RequestHandler
```

**Implementation details:**
- Uses a `Map<string, { count: number; resetTime: number }>` as the store
- Automatic cleanup every 60 seconds via `setInterval` (guards against memory leaks)
- Default key: `req.ip` (supports proxied IPs via `X-Forwarded-For`)
- Sets standard headers on every response:
  - `X-RateLimit-Limit` — max requests in window
  - `X-RateLimit-Remaining` — requests left
  - `X-RateLimit-Reset` — UTC timestamp when window resets
- Returns `429 Too Many Requests` with `{ error: "Too many requests. Please try again later." }` when exceeded
- Skips rate limiting for the health check route (`GET /`)

### Rate Limit Tiers

Apply different limits to different route groups in `server.ts`:

| Tier | Scope | Limit | Window | Rationale |
|------|-------|-------|--------|-----------|
| **Strict** | `/api/auth` (login) | 10 | 15 min | Prevent brute-force attacks |
| **Moderate** | `/api/ai-insights`, `/api/reports` | 5 | 1 min | Expensive compute operations |
| **Standard** | All other `/api/*` routes | 100 | 15 min | General fair usage |

### Files to Modify

1. **Create:** `backend/src/middlewares/rateLimit.ts` — the rate limit middleware
2. **Modify:** `backend/src/server.ts` — apply rate limiters to route groups

### Error Response Format

```json
{
  "error": "Too many requests. Please try again later."
}
```

With headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1724083200
```

## Done When

- [ ] Rate limit middleware created with configurable window, max, and key generator
- [ ] Standard rate limit headers set on all API responses
- [ ] Auth endpoints (login) have strict rate limiting (10 req/15min)
- [ ] Expensive endpoints (AI insights, reports) have moderate limiting (5 req/min)
- [ ] General API endpoints have standard limiting (100 req/15min)
- [ ] 429 response with clear error message when exceeded
- [ ] Automatic cleanup of expired entries to prevent memory leaks
- [ ] TypeScript typecheck passes
