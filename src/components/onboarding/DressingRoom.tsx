"use client";

import { useEffect, useState, type RefObject } from "react";
import type { Garment } from "@/lib/garments";
import { ROTATION_SECONDS, type TryOnState } from "@/hooks/useTryOnSession";
import { Arrow, Button, Eyebrow, Title } from "@/components/ui";
import { track } from "@/lib/analytics";

const NUDGE_AFTER_MS = 20_000;
const HINT_MS = 6_000;

/** Circular countdown ring for the current garment. */
function TimerRing({ seconds }: { seconds: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, seconds / ROTATION_SECONDS));
  return (
    <div className="glass relative flex h-14 w-14 items-center justify-center rounded-full" aria-label={`${seconds} seconds left on this look`}>
      <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth="3" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="var(--color-lime)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - frac)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <span className="font-display text-base font-bold tabular-nums">{seconds}</span>
    </div>
  );
}

export function DressingRoom({
  garments,
  state,
  outputRef,
  onStart,
  onSelect,
  onContinue,
  onNudgeShop,
}: {
  garments: readonly Garment[];
  state: TryOnState;
  outputRef: RefObject<HTMLVideoElement | null>;
  onStart: () => void;
  onSelect: (index: number) => void;
  onContinue: () => void;
  onNudgeShop: () => void;
}) {
  const live = state.phase === "live";
  const connecting = state.phase === "connecting" || state.phase === "camera";
  const [hint, setHint] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [nudgeEpoch, setNudgeEpoch] = useState(0);
  const active = garments[state.activeIndex];

  useEffect(() => {
    if (!live) return setHint(false);
    setHint(true);
    const t = setTimeout(() => setHint(false), HINT_MS);
    return () => clearTimeout(t);
  }, [live]);

  useEffect(() => {
    if (!live) return setNudge(false);
    const t = setTimeout(() => {
      setNudge(true);
      track("nudge_shown");
    }, NUDGE_AFTER_MS);
    return () => clearTimeout(t);
  }, [live, nudgeEpoch]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-3">
      {/* Stage: one surface for every phase, so the <video> stays mounted before the remote stream arrives. */}
      <div className={`relative min-h-0 flex-1 overflow-hidden rounded-[24px] border border-line bg-surface ${connecting ? "scan" : ""}`}>
        <video
          ref={outputRef}
          autoPlay
          playsInline
          muted
          className={`absolute inset-0 h-full w-full -scale-x-100 object-cover transition-opacity duration-700 ${live ? "opacity-100" : "opacity-0"}`}
        />

        {!live && (
          <div className="absolute inset-4 flex flex-col items-center justify-center text-center viewfinder">
            {/* Framing silhouette */}
            <svg viewBox="0 0 120 160" className={`mb-6 h-40 w-auto text-white/15 transition-opacity ${connecting ? "opacity-30" : ""}`} aria-hidden>
              <circle cx="60" cy="38" r="22" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" />
              <path d="M14 160c0-34 20-58 46-58s46 24 46 58" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" />
            </svg>

            {connecting ? (
              <div className="flex flex-col items-center gap-3" aria-live="polite">
                {state.countdownWord && (
                  <span key={state.countdownWord} className="count-pop font-display text-[96px] font-bold leading-none text-lime">
                    {state.countdownWord}
                  </span>
                )}
                <span className="text-[13px] uppercase tracking-[0.16em] text-muted">Step back · fit your top half</span>
              </div>
            ) : (
              <div className="rise max-w-[280px]">
                <Eyebrow>AI dressing room</Eyebrow>
                <Title className="mb-3 text-[30px]!">Step into frame.</Title>
                <p className="mb-6 text-sm leading-relaxed text-muted">Turn on your camera and we&apos;ll dress you in four looks, live.</p>
                <Button onClick={onStart} icon={<Arrow />}>
                  Turn on camera
                </Button>
                <p role="status" aria-live="polite" className="mt-3 min-h-4 text-xs text-muted">
                  {state.status}
                </p>
              </div>
            )}
          </div>
        )}

        {live && (
          <>
            {/* Top bar */}
            <div className="absolute inset-x-3 top-3 z-10 flex items-start justify-between">
              <span className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em]">
                <span className="pulse-dot h-2 w-2 rounded-full bg-live" /> Live
              </span>
              <TimerRing seconds={state.secondsLeft} />
            </div>

            {/* Hint / nudge toast */}
            <div
              className={`glass absolute left-1/2 top-20 z-10 w-[86%] -translate-x-1/2 rounded-2xl px-4 py-3 text-center text-sm font-medium transition duration-500 ${
                hint ? "opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
              }`}
            >
              Hold still — a new look drops every {ROTATION_SECONDS}s
            </div>
            <div
              className={`glass absolute left-1/2 top-20 z-20 flex w-[92%] -translate-x-1/2 items-center gap-2 rounded-2xl p-2 pl-4 transition duration-300 ${
                nudge ? "opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
              }`}
            >
              <p className="flex-1 text-[13px] font-medium">Seen enough? Go shopping.</p>
              <button
                type="button"
                onClick={() => {
                  setNudge(false);
                  setNudgeEpoch((n) => n + 1);
                  track("nudge_dismissed");
                }}
                className="rounded-xl px-3 py-2 text-xs text-muted hover:text-fg"
              >
                Later
              </button>
              <button
                type="button"
                onClick={() => {
                  track("nudge_accepted");
                  onNudgeShop();
                }}
                className="rounded-xl bg-lime px-3 py-2 text-xs font-bold text-bg"
              >
                Shop →
              </button>
            </div>

            {/* Garment dock */}
            <div className="absolute inset-x-3 bottom-3 z-10">
              {active && (
                <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-fg/80">
                  {String(state.activeIndex + 1).padStart(2, "0")} · {active.name}
                </p>
              )}
              <div className="glass grid grid-cols-4 gap-2 rounded-[20px] p-2" role="listbox" aria-label="Garments">
                {garments.map((g, i) => {
                  const on = state.activeIndex === i;
                  return (
                    <button
                      key={g.id}
                      type="button"
                      role="option"
                      aria-selected={on}
                      aria-label={g.name}
                      onClick={() => onSelect(i)}
                      className={`aspect-square overflow-hidden rounded-xl bg-white p-1 transition ${
                        on ? "ring-2 ring-lime ring-offset-2 ring-offset-black/60" : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.image} alt="" draggable={false} className="h-full w-full object-contain" />
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {live && (
        <Button variant="ghost" onClick={onContinue} icon={<Arrow />} className="shrink-0">
          Done — see my picks
        </Button>
      )}
    </div>
  );
}
