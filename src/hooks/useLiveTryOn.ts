"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Product } from "@/lib/catalog";
import { apiErrorMessage } from "@/lib/api-client";

export type LivePhase = "idle" | "starting" | "live";
type FailStage = "camera" | "token" | "connect";
type TokenResponse = { apiKey: string; model: string; maxSessionSeconds: number };

// Minimal surface of the SDK realtime client we rely on.
type RealtimeClient = {
  setImage: (image: Blob | string, opts?: { prompt?: string; enhance?: boolean }) => Promise<void>;
  disconnect: () => void;
  on: (event: string, cb: (arg: unknown) => void) => void;
};

export function cameraErrorMessage(err: unknown): string {
  const msg = String((err as Error)?.message ?? err ?? "");
  const name = (err as { name?: string })?.name ?? "";
  if (/NotAllowed|Permission/i.test(name + msg)) return "Camera access was blocked. Allow it in your browser settings, then try again.";
  if (/NotFound|Overconstrained/i.test(name + msg)) return "No camera was found on this device.";
  if (/NotReadable/i.test(name + msg)) return "Your camera is in use by another app.";
  return "Could not start the camera.";
}

export function useLiveTryOn() {
  const [phase, setPhase] = useState<LivePhase>("idle");
  const [status, setStatus] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const outputRef = useRef<HTMLVideoElement | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const clientRef = useRef<RealtimeClient | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Bumped on every teardown so late promises from an old session become no-ops.
  const epochRef = useRef(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const blobCache = useRef(new Map<string, Blob>());

  /** Idempotent: safe from every exit path. */
  const stop = useCallback((message = "") => {
    epochRef.current++;
    abortRef.current?.abort();
    abortRef.current = null;
    clearInterval(tickRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    try {
      clientRef.current?.disconnect();
    } catch {
      /* already closed */
    }
    clientRef.current = null;
    if (outputRef.current) outputRef.current.srcObject = null;
    setPhase("idle");
    setStatus(message);
  }, []);

  const productBlob = useCallback(async (p: Product, signal?: AbortSignal) => {
    const hit = blobCache.current.get(p.id);
    if (hit) return hit;
    const res = await fetch(p.image, { signal });
    if (!res.ok) throw new Error(`item image ${res.status}`);
    const blob = await res.blob();
    blobCache.current.set(p.id, blob);
    return blob;
  }, []);

  const select = useCallback(
    async (p: Product) => {
      const client = clientRef.current;
      if (!client || !p.live) return;
      const epoch = epochRef.current;
      try {
        const blob = await productBlob(p);
        if (epoch === epochRef.current) await client.setImage(blob, { prompt: p.prompt, enhance: false });
      } catch (err) {
        console.warn("[live] could not apply item", err);
        if (epoch === epochRef.current) setStatus("Couldn't switch to that item. Try again.");
      }
    },
    [productBlob],
  );

  const start = useCallback(
    async (p: Product) => {
      if (abortRef.current || clientRef.current) return; // already starting or live
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus(window.isSecureContext ? "This browser can't use the camera." : "The camera needs a secure (https) connection.");
        return;
      }
      const epoch = ++epochRef.current;
      const abort = (abortRef.current = new AbortController());
      let stage: FailStage = "camera";
      setPhase("starting");
      setStatus("Waiting for camera permission…");

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (epoch !== epochRef.current) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        setStatus("Connecting… this takes a few seconds.");

        stage = "token";
        const res = await fetch("/api/v1/tokens", { method: "POST", cache: "no-store", signal: abort.signal });
        if (!res.ok) throw new Error(await apiErrorMessage(res));
        const token = (await res.json()) as TokenResponse;
        if (!token?.apiKey || !token.model) throw new Error("Incomplete session token.");
        if (epoch !== epochRef.current) return;

        stage = "connect";
        const sdk = await import("@decartai/sdk");
        const client = (await sdk.createDecartClient({ apiKey: token.apiKey }).realtime.connect(stream, {
          model: sdk.models.realtime(token.model as Parameters<typeof sdk.models.realtime>[0]),
          onRemoteStream: (remote: MediaStream) => {
            if (epoch !== epochRef.current) return;
            if (outputRef.current) outputRef.current.srcObject = remote;
            setPhase("live");
            setStatus("");
          },
        })) as unknown as RealtimeClient;

        if (epoch !== epochRef.current) return client.disconnect();
        clientRef.current = client;
        abortRef.current = null;

        client.on("connectionChange", (s) => {
          if (s === "disconnected" && epoch === epochRef.current) stop("The live session ended.");
        });
        client.on("error", (err) => {
          console.warn("[live] provider error", err);
          if (epoch === epochRef.current) setStatus("Connection issue. If the video freezes, stop and start again.");
        });

        // Ends just like the token's maxSessionDuration so the UI closes cleanly before Decart cuts it.
        let left = token.maxSessionSeconds;
        setSecondsLeft(left);
        tickRef.current = setInterval(() => {
          left--;
          setSecondsLeft(left);
          if (left <= 0) stop("Session time is up. Start again to keep trying.");
        }, 1000);
        await select(p);
      } catch (err) {
        if (epoch !== epochRef.current) return;
        // A refused or missing camera is an expected user outcome, not an app error.
        (stage === "camera" ? console.warn : console.error)(`[live] start failed at ${stage}:`, err);
        stop(stage === "camera" ? cameraErrorMessage(err) : (err as Error)?.message || "Couldn't start the live session. Please try again.");
      }
    },
    [select, stop],
  );

  // Release the camera the moment the page is hidden (privacy, and no billed idle GPU time).
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden" && (streamRef.current || clientRef.current || abortRef.current)) stop("Paused because you left the page.");
    };
    const onPageHide = () => stop();
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      stop();
    };
  }, [stop]);

  return { phase, status, secondsLeft, outputRef, start, stop, select };
}
