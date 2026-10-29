# Security and privacy

## Secrets
- `DECART_API_KEY` is read only in `src/lib/server/env.ts` (`server-only` import: a client import fails the build).
  It is used to mint live tokens and to call the photo API from the server. It never reaches the browser.
- Live mode receives a client token: 60 s TTL, `allowedOrigins` = the verified origin,
  `constraints.realtime.maxSessionDuration` = `DECART_MAX_SESSION_SECONDS`.
- The logger redacts secret-named keys and `dct_…` strings, and never logs token values.
- `.env` is git-ignored and has never been committed (checked with `git log --all`).
  If a key is ever committed, rotate it on platform.decart.ai; deleting the file does not remove it from history.

## Paid-API protection (`src/lib/server/guard.ts`)
- Origin/Referer must be in `APP_ORIGINS` (dev also accepts the request's own host). This blocks other websites,
  but it is **not authentication**: scripts can forge headers.
- Per-IP limit, using the right-most `x-forwarded-for` entry (set by the platform proxy on Vercel), plus a
  **global** per-minute cap that bounds spend even if IPs are spoofed or rotated.
- Photo route: `Content-Length` required and capped, images ≤ 2 MB, format checked by magic bytes (SVG/HTML rejected),
  max 4 concurrent provider calls per instance, 60 s timeout, provider output re-checked as an image.
- No user text reaches a model; the server never fetches URLs supplied by users.
- Limits are in memory per instance; see `DEPLOYMENT.md`.

## Browser
- Headers: `Permissions-Policy: camera=(self), microphone=(), geolocation=()`, `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Cross-Origin-Opener-Policy: same-origin`; in production
  also CSP (`connect-src 'self' https://*.decart.ai wss://*.decart.ai`) and HSTS.
  `script-src` still allows `'unsafe-inline'` for Next's bootstrap.
- Camera is requested only when the user presses Start (after the 18+/terms checkbox); audio is never requested.

## Privacy: what is and isn't collected
- No accounts, profiles, cookies, local storage, analytics or third-party scripts/fonts.
- Photos: resized and EXIF-stripped in the browser, sent only when the user presses "Try it on", forwarded to Decart,
  held in server memory for that request only. Not written to disk, a database or logs.
- Live video goes browser → Decart directly; nothing is recorded.
- Server logs: outcome and timing only (no images, request bodies or IP addresses). The hosting provider keeps its
  own standard request logs, which include IPs.
- Decart processes the images; its retention is governed by Decart's terms. Check them and keep the privacy policy
  (`src/lib/legal.ts`) accurate if anything changes.
- No face recognition, biometric identification or tracking.
