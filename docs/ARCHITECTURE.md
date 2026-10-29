# Architecture

One Next.js app, two server routes, no database.

```
Browser
 ├─ TryOn page (Catalog + preview + controls)
 ├─ Photo mode: prepareImage() → ≤1280px JPEG, EXIF stripped
 │     POST /api/v1/tryon (multipart) ──► server ──► Decart lucy-image-2 (process API) ──► image ──► browser
 └─ Live mode: getUserMedia (after consent + Start)
       POST /api/v1/tokens ──► short-lived client token
       @decartai/sdk realtime.connect(stream) ── WebRTC ──► Decart lucy-vton ──► remote video
       setImage(garment, { prompt }) to switch items

Server (Node runtime)
 ├─ guard: Origin in APP_ORIGINS → per-IP limit → global limit → key configured
 ├─ /api/v1/tokens : guard (5/min/IP, 30/min total) → mint token (origin-scoped, session-capped)
 └─ /api/v1/tryon  : guard (6/min/IP, 30/min total) → size + magic-byte checks → fixed prompt
                     → max 4 in flight → 60 s timeout → re-typed image, Cache-Control: no-store
```

## API

All errors: `{ "error": { "code": string, "message": string } }`, `Cache-Control: no-store`.

### `POST /api/v1/tokens`
No body. `200` → `{ apiKey, expiresAt, model, maxSessionSeconds }`.

### `POST /api/v1/tryon`
`multipart/form-data`, `Content-Length` required, body ≤ ~4.1 MB:

| Field | |
|---|---|
| `photo` | required; JPEG/PNG/WebP by magic bytes; ≤ 2 MB |
| `productId` | a catalog id, **or** |
| `category` | a category id, for an uploaded item (then `item` is required) |
| `item` | optional item image (same rules as `photo`); used as the reference for photographed products and uploads |

`200` → the image (`image/jpeg|png|webp`).

| Status | code | When |
|---|---|---|
| 400 | `invalid_body` | missing photo/item, unknown product or category, malformed form |
| 403 | `forbidden_origin` | Origin/Referer not allowed |
| 411 | `invalid_body` | no `Content-Length` |
| 413 | `payload_too_large` | body or an image too large |
| 415 | `unsupported_media_type` | not JPEG/PNG/WebP |
| 429 | `rate_limited` | per-IP or global limit (`Retry-After`) |
| 502 | `upstream_failed` | provider error or non-image response |
| 503 | `not_configured` / `busy` | no key / 4 requests already in flight |
| 504 | `timeout` | provider took > 60 s |

## Client lifecycle

- `useLiveTryOn`: `idle → starting → live`. One idempotent `stop()` stops camera tracks, aborts a pending token
  request, disconnects the SDK client and clears the timer. It runs on Stop, mode switch, timer end, provider
  disconnect, tab hidden, `pagehide` and unmount. An epoch counter makes late promises from an old session no-ops.
- `usePhotoTryOn`: each run gets its own `AbortController`; a newer run or Cancel aborts the old one, and only the
  current controller may write state. Object URLs are created and revoked by `useObjectUrl`.
