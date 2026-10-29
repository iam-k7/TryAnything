# Deployment (Vercel)

1. Import the repo in Vercel (framework: Next.js, Node ≥ 20.19).
2. Set env vars separately for Preview and Production, with a separate Decart key for each:
   `DECART_API_KEY`, `APP_ORIGINS` (e.g. `https://tryanything.app`; for Preview, the preview domain),
   and any optional tuning from `.env.example`.
3. Configure a spend limit/alert on platform.decart.ai.
4. Smoke test on a real phone and a desktop:
   - Photo: pick an item → choose a photo → Try it on → result → Show original → Try another item → Cancel mid-run.
   - Live: Start camera → item switch → Stop; deny camera permission once; switch tabs mid-session.
   - Upload your own item with each category type.

## Before public launch
- [ ] Replace the in-memory rate limiter and concurrency cap with a shared store (e.g. Upstash Redis); on serverless,
      each instance currently has its own counters, so the effective limits multiply by instance count.
- [ ] Fill in the `[BRACKETED]` placeholders in `src/lib/legal.ts` and have the texts reviewed.
- [ ] Read Decart's data-retention terms and confirm the privacy policy matches.
- [ ] Evaluate photo-mode quality per category with real product photos; hide categories that don't work well.
- [ ] Consider Next 16 (clears the remaining build-time `postcss` advisory) and a nonce-based CSP.
- [ ] Rollback plan: Vercel "Promote previous deployment".

Vercel limits request bodies to 4.5 MB; the app keeps uploads under that by resizing in the browser.
