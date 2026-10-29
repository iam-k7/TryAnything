"use client";

import { useEffect, useRef, useState } from "react";
import { findCategory, type CategoryId, type Product } from "@/lib/catalog";
import type { TryOnItem } from "@/lib/api-client";
import { prepareImage } from "@/lib/image-file";
import { useObjectUrl, usePhotoTryOn } from "@/hooks/usePhotoTryOn";
import { useLiveTryOn } from "@/hooks/useLiveTryOn";
import { Button, LEGAL_LINKS, Logo, Section } from "./ui";
import { Catalog, type Selection } from "./Catalog";

type Mode = "photo" | "live";

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

export function TryOn() {
  const [mode, setMode] = useState<Mode>("photo");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [notice, setNotice] = useState("");

  const photoTry = usePhotoTryOn();
  const live = useLiveTryOn();
  const photoUrl = useObjectUrl(photo);
  const resultUrl = useObjectUrl(photoTry.result);

  const product = selection?.kind === "product" ? selection.product : null;
  const category = selection?.kind === "product" ? selection.product.category : selection?.category || null;
  const small = category ? "small" in findCategory(category) : false;
  const working = photoTry.status === "working";
  const liveBusy = live.phase !== "idle";

  // On phones the preview sits below the controls; bring it into view once something starts.
  const previewRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if ((working || live.phase === "starting") && window.matchMedia("(max-width: 1023px)").matches)
      previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [working, live.phase]);

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    photoTry.cancel();
    live.stop();
    setNotice("");
    if (m === "live" && selection && !(product?.live)) setSelection(null);
    setMode(m);
  };

  const choose = (p: Product) => {
    setSelection({ kind: "product", product: p });
    setNotice("");
    if (live.phase === "live") void live.select(p);
  };

  const pickImage = async (file: File, use: (b: Blob) => void) => {
    setNotice("");
    try {
      use(await prepareImage(file));
    } catch (err) {
      setNotice((err as Error).message);
    }
  };

  const tryOnPhoto = async () => {
    if (!photo || !selection) return;
    setShowOriginal(false);
    let item: TryOnItem;
    if (selection.kind === "custom") {
      if (!selection.category) return setNotice("Choose what kind of item you uploaded.");
      item = { category: selection.category, image: selection.image };
    } else {
      // Real product photos go along as a reference; the server never fetches URLs itself.
      const p = selection.product;
      const image = p.reference ? await fetch(p.image).then((r) => (r.ok ? r.blob() : undefined)).catch(() => undefined) : undefined;
      item = { product: p, image };
    }
    void photoTry.run(photo, item);
  };

  const startOver = () => {
    photoTry.cancel();
    live.stop();
    setSelection(null);
    setPhoto(null);
    setNotice("");
  };

  const canTryPhoto = Boolean(photo && selection && agreed && !working);
  const canStartLive = Boolean(product?.live && agreed && !liveBusy);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col px-4">
      <header className="flex items-center justify-between py-4">
        <Logo />
        <a href="/legal/privacy" className="text-[13px] text-muted underline-offset-2 hover:text-fg hover:underline">
          Privacy
        </a>
      </header>

      <main className="grid flex-1 grid-cols-1 gap-6 pb-8 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-10">
        {/* Preview */}
        <div ref={previewRef} className="order-last scroll-mt-4 lg:sticky lg:top-4 lg:order-none lg:self-start">
          <div className="relative mx-auto aspect-[3/4] max-h-[78dvh] w-full overflow-hidden rounded-md border border-line bg-surface">
            {mode === "live" ? (
              <>
                <video
                  ref={live.outputRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 h-full w-full -scale-x-100 object-cover ${live.phase === "live" ? "" : "invisible"}`}
                />
                {live.phase === "live" && (
                  <span className="absolute left-3 top-3 rounded bg-white/90 px-2 py-1 text-[12px] tabular-nums">
                    Live · {mmss(live.secondsLeft)} left
                  </span>
                )}
                {live.phase !== "live" && (
                  <Placeholder>{live.phase === "starting" ? live.status : "Your live preview will appear here."}</Placeholder>
                )}
              </>
            ) : resultUrl && !showOriginal ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={resultUrl} alt="Your try-on preview" className="absolute inset-0 h-full w-full object-contain" />
            ) : photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Your photo" className="absolute inset-0 h-full w-full object-contain" />
            ) : (
              <Placeholder>Your preview will appear here.</Placeholder>
            )}

            {working && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85 text-center" role="status">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-fg motion-reduce:animate-none" aria-hidden />
                <p className="text-[14px]">Creating your preview… this can take up to a minute.</p>
                <Button variant="secondary" onClick={photoTry.cancel}>
                  Cancel
                </Button>
              </div>
            )}
          </div>

          {mode === "photo" && resultUrl && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setShowOriginal((v) => !v)} aria-pressed={showOriginal}>
                {showOriginal ? "Show preview" : "Show original"}
              </Button>
              <Button variant="secondary" onClick={() => photoTry.cancel()}>
                Try another item
              </Button>
              <Button variant="secondary" onClick={startOver}>
                Start over
              </Button>
            </div>
          )}

          {(photoTry.error || (mode === "live" && live.phase === "idle" && live.status)) && (
            <p role="alert" className="mt-3 text-[14px] text-danger">
              {mode === "photo" ? photoTry.error : live.status}
            </p>
          )}
          {mode === "live" && live.phase === "live" && live.status && (
            <p role="status" className="mt-3 text-[14px] text-muted">
              {live.status}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col gap-6">
          <div>
            <h1 className="mb-1 text-[22px] font-semibold leading-tight tracking-tight">See it on you before you buy.</h1>
            <p className="text-[14px] text-muted">Pick an item, add a photo of yourself, and get an AI preview.</p>
          </div>

          <Section step={1} title="Choose an item">
            <Catalog
              selection={selection}
              liveOnly={mode === "live"}
              onSelect={choose}
              onUpload={(f) => void pickImage(f, (image) => setSelection({ kind: "custom", category: "", image }))}
              onCustomCategory={(c: CategoryId) => selection?.kind === "custom" && setSelection({ ...selection, category: c })}
            />
            {small && <p className="mt-3 text-[13px] text-muted">Small accessories are experimental and may not appear accurately.</p>}
          </Section>

          <Section step={2} title="Add yourself">
            <div className="mb-4 grid grid-cols-2 rounded-md border border-line bg-surface p-1" role="group" aria-label="Try-on method">
              {(["photo", "live"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={mode === m}
                  onClick={() => switchMode(m)}
                  className={`min-h-10 rounded text-[14px] transition-colors ${mode === m ? "bg-fg text-white" : "text-fg hover:bg-bg"}`}
                >
                  {m === "photo" ? "Use a photo" : "Live camera"}
                </button>
              ))}
            </div>

            {mode === "photo" ? (
              <div className="space-y-2 text-[14px]">
                <label className="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line bg-surface px-4 font-medium hover:border-fg/40 focus-within:outline-2 focus-within:outline-fg">
                  {photo ? "Change photo" : "Choose a photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void pickImage(f, (b) => (photoTry.cancel(), setPhoto(b)));
                    }}
                  />
                </label>
                <p className="text-muted">A clear, well-lit photo facing the camera works best. Show the part of you the item goes on.</p>
              </div>
            ) : (
              <div className="space-y-2 text-[14px] text-muted">
                <p>Live camera works with items marked “Live” (tops and jackets). Stand back so your upper body is in frame.</p>
                <p>Your browser will ask for camera permission when you press Start. Audio is never used.</p>
              </div>
            )}
          </Section>

          <Section step={3} title="Preview">
            <label className="mb-4 flex items-start gap-3 text-[14px]">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                I&apos;m 18 or older and agree to the{" "}
                {LEGAL_LINKS.map((l, i) => (
                  <span key={l.href}>
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                      {l.label}
                    </a>
                    {i === 0 ? ", " : i === 1 ? " and " : "."}
                  </span>
                ))}
              </span>
            </label>

            {mode === "photo" ? (
              <Button className="w-full" disabled={!canTryPhoto} onClick={() => void tryOnPhoto()}>
                {working ? "Working…" : "Try it on"}
              </Button>
            ) : liveBusy ? (
              <Button className="w-full" variant="secondary" onClick={() => live.stop()}>
                Stop camera
              </Button>
            ) : (
              <Button className="w-full" disabled={!canStartLive} onClick={() => product && void live.start(product)}>
                Start camera
              </Button>
            )}

            {notice && (
              <p role="alert" className="mt-3 text-[14px] text-danger">
                {notice}
              </p>
            )}

            <p className="mt-3 text-[13px] leading-relaxed text-muted">
              {mode === "photo"
                ? "When you press Try it on, your photo (resized, with location data removed) and the item are sent to our AI provider, Decart, to make the preview. We don't store them."
                : "While the camera is on, your video streams to our AI provider, Decart, to make the preview. Nothing is recorded. The session stops when time runs out or you leave the page."}
            </p>
          </Section>
        </div>
      </main>

      <footer className="flex flex-col gap-2 border-t border-line py-4 text-[12px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>Previews are AI approximations, not a guarantee of fit, size, fabric or colour.</p>
        <nav className="flex gap-4">
          {LEGAL_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="hover:text-fg">
              {l.label}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-[14px] text-muted">{children}</div>;
}
