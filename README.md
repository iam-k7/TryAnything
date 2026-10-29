# TryAnything

A simple AI virtual try-on website for phones and desktops. Pick a sample item (or upload a photo of your own),
then either **upload a photo of yourself** or **use your camera live**, and see an AI preview.

Previews are visual approximations, not a guarantee of fit, size, fabric or colour.

**Stack:** Next.js 15 (App Router) · TypeScript (strict) · Tailwind v4 · `@decartai/sdk` · zod · Vitest.
No database, no accounts, no analytics.

## How it works

| Mode | Model (verified in `@decartai/sdk` 0.2.14) | Data path |
|---|---|---|
| Photo | `lucy-image-2` image editing: `client.process({ prompt, data, reference_image })` | Browser resizes the photo to ≤1280 px JPEG (strips EXIF/GPS) → `POST /api/v1/tryon` → Decart → image back. Held in memory only. |
| Live camera | `lucy-vton-latest` realtime try-on over WebRTC | Browser gets a 60 s client token from `POST /api/v1/tokens`, then streams directly to Decart. Never touches our server. |

**What each mode supports**

- *Live camera*: only the photographed garments (tops and jackets, marked "Live"). `lucy-vton` is a clothing model;
  it is not used for accessories.
- *Photo*: every catalog category, plus uploaded items. `lucy-image-2` is a general image-editing model guided by a
  fixed prompt and, for real product photos, a reference image. It is **not** a dedicated try-on model, so results
  vary, and small accessories (hats, glasses, jewellery) are labelled experimental in the UI.
- No user-written text ever reaches a model. Prompts are fixed per catalog item, or built from the category the user
  picks for an uploaded item (`src/lib/catalog.ts`).

The photo provider sits behind one function type (`PhotoTryOn` in `src/lib/server/photo-tryon.ts`), so another
provider can be added without touching the UI.

## Run locally

```bash
cp .env.example .env.local     # add DECART_API_KEY
npm ci
npm run dev                    # https://localhost:3000 (camera needs HTTPS on phones)
```

Checks:

```bash
npm test            # unit + API tests, Decart SDK mocked (no credits used)
npm run typecheck
npm run build
```

There is no lint script configured.

## Environment

| Name | Required | Default | Purpose |
|---|---|---|---|
| `DECART_API_KEY` | yes | — | Server-only Decart key. Without it both APIs answer `503`. |
| `APP_ORIGINS` | yes in prod | `http://localhost:3000` | Comma-separated origins allowed to call the paid APIs; also scopes live tokens. |
| `DECART_MODEL` | no | `lucy-vton-latest` | Realtime model; must be a realtime model known to the SDK. |
| `DECART_IMAGE_MODEL` | no | `lucy-image-2` | Photo model; must be an image model known to the SDK. |
| `DECART_SCOPE_TOKEN_TO_MODEL` | no | `false` | Also restrict live tokens to `DECART_MODEL` (turn on once your account accepts the slug). |
| `DECART_TOKEN_TTL_SECONDS` | no | `60` | Live token lifetime (1–3600). |
| `DECART_MAX_SESSION_SECONDS` | no | `180` | Hard cap per live session (10–3600). |

Nothing is exposed to the browser through `NEXT_PUBLIC_*`.

## Layout

```
src/app/page.tsx                 renders <TryOn/>
src/app/api/v1/tokens            live-mode client tokens
src/app/api/v1/tryon             photo try-on
src/app/legal/[doc]              privacy, terms, acceptable use
src/components/                  TryOn (page), Catalog, ui
src/hooks/                       useLiveTryOn (camera → token → WebRTC → cleanup), usePhotoTryOn
src/lib/catalog.ts               categories, products, prompts
src/lib/upload.ts                upload limits + magic-byte sniffing (shared client/server)
src/lib/server/                  env, guard (origin + rate limits), Decart token + photo provider, logger
docs/                            architecture/API, security & privacy, deployment
```

## Catalog images

Photos in `public/garments/` are from DecartAI/tryon-examples (MIT, see the licence file there).
Line drawings in `public/catalog/` were made for this repo. They are only shown in the UI and are not sent
to the model; replace them with real product photos you have rights to (set `reference: true`) for better results.

## Known limitations

- Rate limits and the concurrency cap are in memory, per server instance. Use a shared store (e.g. Upstash Redis)
  before scaling out; see `docs/DEPLOYMENT.md`.
- Photo quality and accessory accuracy have not been checked against the live API in this repo's tests.
- Next's bundled `postcss` still has an audit advisory that is only fixed in Next 16 (build-time only; it processes our own CSS).
- CSP allows `'unsafe-inline'` scripts for Next's bootstrap; move to nonces when practical.
- Legal pages contain `[BRACKETED]` placeholders that must be filled in and reviewed before launch.
