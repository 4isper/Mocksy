"use client";

import { useSheetSwipeDismiss } from "@/lib/hooks/useSheetSwipeDismiss";

/**
 * The pill-shaped grabber at the top of a mobile bottom sheet. Purely a
 * touch affordance (aria-hidden): dragging it down dismisses the sheet,
 * while Esc, the backdrop and the tab bar stay the accessible paths.
 * Must be rendered as a direct child of the `.sheet-host` element — the
 * hook treats the parent as the sheet to translate.
 */
export function SheetGrabber({ onDismiss }: { onDismiss: () => void }) {
  const swipe = useSheetSwipeDismiss({ onDismiss });
  return (
    <div
      aria-hidden="true"
      className="sheet-grabber"
      onPointerDown={swipe.onPointerDown}
      onPointerMove={swipe.onPointerMove}
      onPointerUp={swipe.onPointerUp}
      onPointerCancel={swipe.onPointerCancel}
    >
      <span className="sheet-grabber-bar" />
    </div>
  );
}
