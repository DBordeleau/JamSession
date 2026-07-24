"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useId, useRef } from "react";

export function DeviceDraftDiscardDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm(): void;
  onCancel(): void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    cancelRef.current?.focus();
    return () => returnFocusRef.current?.focus();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;
    if (event.shiftKey && document.activeElement === cancelRef.current) {
      event.preventDefault();
      confirmRef.current?.focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === confirmRef.current
    ) {
      event.preventDefault();
      cancelRef.current?.focus();
    }
  }

  return (
    <div
      className="bg-canvas/80 fixed inset-0 z-50 grid overflow-y-auto p-4 backdrop-blur-sm"
      role="presentation"
    >
      <motion.div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        onKeyDown={handleKeyDown}
        className="dash-card dash-card-lit rounded-card border-strong m-auto w-full max-w-md border p-6 shadow-2xl"
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }
        }
        data-reduced-motion={reduceMotion ? "true" : "false"}
      >
        <p className="eyebrow">Device draft</p>
        <h2 id={titleId} className="mt-2 text-2xl font-semibold">
          Discard this device draft?
        </h2>
        <p id={bodyId} className="text-muted mt-3 text-sm leading-6">
          This removes only the unapplied MIDI draft from this browser. The
          current immutable pattern version in the arrangement stays exactly as
          it is.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="border-strong hover:border-accent hover:text-accent inline-flex min-h-11 items-center justify-center rounded-full border px-4 text-sm font-semibold transition-colors"
          >
            Continue editing
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className="bg-danger text-canvas hover:bg-danger/90 inline-flex min-h-11 items-center justify-center rounded-full px-5 text-sm font-semibold transition-colors"
          >
            Discard device draft
          </button>
        </div>
      </motion.div>
    </div>
  );
}
