"use client";

import { useLiveAnnouncer } from "@/lib/state/liveAnnouncer";

/** Renders an `aria-live` region that announces status messages to screen
 *  readers. Mount once at the top of the editor shell. */
export function LiveAnnouncer() {
  const message = useLiveAnnouncer((s) => s.message);
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
      data-testid="live-announcer"
    >
      {message}
    </div>
  );
}
