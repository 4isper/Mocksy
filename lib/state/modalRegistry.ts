"use client";

/**
 * Module-level registry of open modal surfaces. Dialogs that live inside
 * panels (inline confirmations, sheets, the onboarding tour) register here so
 * the global keyboard-shortcut gate can see them — those states are local to
 * their panel components, so polling props through the store would thread
 * props through a dozen components. Dialogs owned by EditorShell state
 * (confirm-reset, export, shortcuts, palette, share-QR) are already gated
 * directly and don't need to register.
 */

const openSurfaces = new Set<string>();

export function openModalSurface(id: string): () => void {
  openSurfaces.add(id);
  return () => {
    openSurfaces.delete(id);
  };
}

export function hasOpenModalSurface(): boolean {
  return openSurfaces.size > 0;
}
