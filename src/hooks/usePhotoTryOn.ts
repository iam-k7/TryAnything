"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { requestPhotoTryOn, type TryOnItem } from "@/lib/api-client";

type PhotoState = { status: "idle" | "working" | "done" | "error"; result: Blob | null; error: string };
const idle: PhotoState = { status: "idle", result: null, error: "" };

export function usePhotoTryOn() {
  const [state, setState] = useState<PhotoState>(idle);
  const ctrlRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    setState(idle);
  }, []);

  const run = useCallback(async (photo: Blob, item: TryOnItem) => {
    ctrlRef.current?.abort(); // a newer request always wins
    const ctrl = (ctrlRef.current = new AbortController());
    setState({ status: "working", result: null, error: "" });
    try {
      const result = await requestPhotoTryOn(photo, item, ctrl.signal);
      if (ctrlRef.current === ctrl) setState({ status: "done", result, error: "" });
    } catch (err) {
      if (ctrl.signal.aborted || ctrlRef.current !== ctrl) return;
      setState({ status: "error", result: null, error: (err as Error)?.message || "Something went wrong. Please try again." });
    } finally {
      if (ctrlRef.current === ctrl) ctrlRef.current = null;
    }
  }, []);

  useEffect(() => () => ctrlRef.current?.abort(), []);

  return { ...state, run, cancel };
}

/** Object URL for a Blob, revoked when the Blob changes or the component unmounts. */
export function useObjectUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return setUrl(null);
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}
