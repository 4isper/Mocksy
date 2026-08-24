import { useEffect, useRef } from "react";
import { useEditorStore } from "@/lib/state/editorStore";
import { getCopiedObject, setCopiedObject } from "@/lib/state/editorClipboard";
import { resolveZoomScale, stepZoomDirection, zoomAroundCenter } from "@/lib/render/previewViewport";

/** Steps the preview view zoom by one stop around the viewport center. */
function zoomPreview(direction: 1 | -1): void {
  const st = useEditorStore.getState();
  const factor = stepZoomDirection(resolveZoomScale(st.previewZoom), direction) / resolveZoomScale(st.previewZoom);
  if (factor === 1) return;
  const next = zoomAroundCenter(st.previewZoom, factor, st.previewPan);
  st.setPreviewPan(next.pan);
  st.setPreviewZoom(next.zoom);
}

export interface EditorShortcutActions {
  saveNow: () => void;
  onReset: () => void;
  onNewProject: () => void;
  onExportPng: () => void;
  onExportMp4: () => void;
  onExportGif: () => void;
  onExportWebm: () => void;
  onExportWebp: () => void;
  onExportWebpAnim: () => void;
  onExportSvg: () => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onCopyPng: () => void;
  onOpenShortcuts: () => void;
  onOpenCommandPalette: () => void;
  onToggleFullscreen: () => void;
  isModalOpen: () => boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
}

/** Letter for shortcut matching, taken from `event.code` (the physical key) so
 *  shortcuts keep working on non-Latin layouts — ⌘S under a Russian layout
 *  produces key "ы", but still code "KeyS". Falls back to a single-character
 *  `event.key` for synthetic events that carry no code (tests). */
function eventLetter(event: KeyboardEvent): string {
  const fromCode = /^Key([A-Z])$/.exec(event.code)?.[1]?.toLowerCase();
  if (fromCode) return fromCode;
  const key = event.key.toLowerCase();
  return key.length === 1 ? key : "";
}

/** "[" / "]" for the layer-selection cycle, physical-key first like letters. */
function eventBracket(event: KeyboardEvent): "[" | "]" | null {
  if (event.code === "BracketLeft" || event.key === "[") return "[";
  if (event.code === "BracketRight" || event.key === "]") return "]";
  return null;
}

/**
 * Global editor keyboard shortcuts: ⌘K command palette, ⌘Z/⌘⇧Z/⌘Y undo/redo,
 * ⌘N new project, ⌘S save, ⌘E/⌘⇧E/⇧⌘G/⇧⌘W/⇧⌘P/⌘⇧A/⌘⇧S/⌘⇧H/⌘⇧F exports,
 * ⌘⇧C clipboard copy, ⌘D duplicate layer, ⌘↑/⌘↓ layer order, ⌘[/⌘] cycle
 * layer selection, plain arrow keys nudge frames, "?" cheat sheet, "R" reset,
 * "F" full-screen preview (Esc exits). Letter shortcuts match the physical
 * key (`event.code`), so they work on non-Latin keyboard layouts too. Actions
 * are read through a ref so the window listener is bound once and never needs
 * re-subscribing.
 */
export function useEditorShortcuts(actions: EditorShortcutActions): void {
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const a = actionsRef.current;
      const modifier = event.metaKey || event.ctrlKey;
      const letter = eventLetter(event);
      const bracket = eventBracket(event);
      const typing = isTypingTarget(event.target);
      // Skip shortcuts when a modal dialog is open.
      if (a.isModalOpen()) return;
      // ? opens the keyboard-shortcuts cheat sheet. Skip while typing so it
      // doesn't interfere with "?" typed into a text field. Match on the
      // physical key (code "Slash" + Shift) so it's layout-independent
      // and robust to how the "?" character is delivered (event.key).
      if ((event.key === "?" || (event.code === "Slash" && event.shiftKey)) && !typing) {
        event.preventDefault();
        a.onOpenShortcuts();
        return;
      }
      // ⌘K opens the command palette
      if (modifier && letter === "k") {
        event.preventDefault();
        a.onOpenCommandPalette();
        return;
      }
      // Preview view zoom: ⌘+/⌘− step around the viewport center, ⌘0 resets
      // to fit. Physical codes first (Equal/Minus/Digit0) so numpad and
      // layout variants match; these shadow the browser's page zoom.
      if (modifier && !typing && !event.shiftKey && (event.code === "Equal" || event.key === "=" || event.key === "+")) {
        event.preventDefault();
        zoomPreview(1);
        return;
      }
      if (modifier && !typing && (event.code === "Minus" || event.key === "-")) {
        event.preventDefault();
        zoomPreview(-1);
        return;
      }
      if (modifier && !typing && (event.code === "Digit0" || event.key === "0")) {
        event.preventDefault();
        useEditorStore.getState().resetPreviewView();
        return;
      }
      if (modifier && letter === "z") {
        event.preventDefault();
        const st = useEditorStore.getState();
        if (event.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (modifier && letter === "y") {
        event.preventDefault();
        useEditorStore.getState().redo();
        return;
      }
      // ⌘⇧S exports SVG — must be checked before the plain ⌘S save handler.
      if (modifier && event.shiftKey && letter === "s") {
        event.preventDefault();
        a.onExportSvg();
        return;
      }
      if (modifier && letter === "s") {
        event.preventDefault();
        a.saveNow();
        return;
      }
      if (modifier && !event.shiftKey && letter === "n") {
        event.preventDefault();
        a.onNewProject();
        return;
      }
      if (modifier && event.shiftKey && letter === "w") {
        event.preventDefault();
        a.onExportWebm();
        return;
      }
      if (modifier && event.shiftKey && letter === "p") {
        event.preventDefault();
        a.onExportWebp();
        return;
      }
      if (modifier && event.shiftKey && letter === "a") {
        event.preventDefault();
        a.onExportWebpAnim();
        return;
      }
      if (modifier && event.shiftKey && letter === "h") {
        event.preventDefault();
        a.onExportHtml();
        return;
      }
      // ⌘⇧F exports PDF (F as in File/PDF; ⌘⇧P is taken by WebP).
      if (modifier && event.shiftKey && letter === "f") {
        event.preventDefault();
        a.onExportPdf();
        return;
      }
      if (modifier && !event.shiftKey && letter === "e") {
        event.preventDefault();
        a.onExportPng();
        return;
      }
      // ⌘⇧E exports MP4, ⌘⇧G exports GIF (the GIF module is
      // still loaded lazily, via the same dynamic import as MP4).
      if (modifier && event.shiftKey && letter === "e") {
        event.preventDefault();
        a.onExportMp4();
        return;
      }
      if (modifier && event.shiftKey && letter === "g") {
        event.preventDefault();
        a.onExportGif();
        return;
      }
      // ⌘⇧C copies a PNG snapshot to the clipboard (⌘C alone stays
      // free for normal text copy while typing in a field).
      if (modifier && event.shiftKey && letter === "c") {
        event.preventDefault();
        a.onCopyPng();
        return;
      }
      // ⌘C copies the selected annotation or frame instance onto the editor's
      // internal object clipboard (plain ⌘C; ⌘⇧C above is the PNG copy).
      // Pasting happens in useClipboardPaste's window paste handler so OS
      // clipboard media always wins over object paste on ⌘V.
      if (modifier && !event.shiftKey && !typing && letter === "c") {
        const st = useEditorStore.getState();
        const annId = st.selectedAnnotationId;
        const frameId = st.activeFrameInstanceId;
        if (annId) setCopiedObject({ kind: "annotation", id: annId });
        else if (frameId) setCopiedObject({ kind: "frameInstance", id: frameId });
        else return;
        event.preventDefault();
        return;
      }
      // Layer shortcuts: ⌘D duplicates the active layer, ⌘↑/⌘↓ move it.
      // Skip while typing in a field so they don't hijack text editing.
      if (modifier && !typing && letter === "d") {
        event.preventDefault();
        const st = useEditorStore.getState();
        const id = st.activeLayerId ?? st.scene.layers[0]?.id;
        if (id) st.duplicateLayer(id);
        return;
      }
      if (modifier && !typing && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const st = useEditorStore.getState();
        const ids = st.scene.layers.map((l) => l.id);
        const idx = ids.indexOf(st.activeLayerId ?? st.scene.layers[0]?.id ?? "");
        const dir = event.key === "ArrowUp" ? -1 : 1;
        const next = idx + dir;
        if (idx < 0 || next < 0 || next >= ids.length) return;
        const firstId = ids[idx];
        const secondId = ids[next];
        if (firstId === undefined || secondId === undefined) return;
        ids[idx] = secondId;
        ids[next] = firstId;
        st.reorderLayers(ids);
        return;
      }
      // ⌘[/⌘] cycle the layer selection (up/down the layer list).
      if (modifier && !typing && bracket !== null) {
        event.preventDefault();
        const st = useEditorStore.getState();
        const ids = st.scene.layers.map((l) => l.id);
        const idx = ids.indexOf(st.activeLayerId ?? st.scene.layers[0]?.id ?? "");
        if (idx < 0) return;
        const dir = bracket === "[" ? -1 : 1;
        const nextIdx = Math.max(0, Math.min(ids.length - 1, idx + dir));
        const id = ids[nextIdx];
        if (id) st.selectLayer(id);
        return;
      }
      // Arrow keys nudge the selected frame instance on the canvas.
      if (!modifier && !typing && event.key.startsWith("Arrow")) {
        const st = useEditorStore.getState();
        let id = st.activeFrameInstanceId;
        if (!id && st.scene.frameInstances.length > 0) {
          id = st.scene.frameInstances[0]!.id;
          st.selectFrameInstance(id);
        }
        const inst = st.scene.frameInstances.find((fi) => fi.id === id);
        // No frame to nudge (single-frame mode) — let the browser scroll.
        if (!inst) return;
        event.preventDefault();
        const step = event.shiftKey ? 0.05 : 0.01;
        const dirs: Record<string, [number, number]> = {
          ArrowUp: [0, -step],
          ArrowDown: [0, step],
          ArrowLeft: [-step, 0],
          ArrowRight: [step, 0]
        };
        const [dx, dy] = dirs[event.key] ?? [0, 0];
        const x = Math.max(0, Math.min(1, inst.x + dx));
        const y = Math.max(0, Math.min(1, inst.y + dy));
        st.updateFrameInstance(id!, { x, y });
        return;
      }
      if (letter === "r" && !modifier) {
        if (typing) return;
        event.preventDefault();
        a.onReset();
        return;
      }
      // F toggles the full-screen preview (plain key, like R). Skipped while
      // typing so it can't hijack text fields; ⌘⇧F (PDF export) is matched
      // earlier because of its modifier.
      if (letter === "f" && !modifier && !typing) {
        event.preventDefault();
        a.onToggleFullscreen();
        return;
      }
      // Esc leaves the full-screen preview. Modal dialogs handle their own Esc
      // and are excluded by the isModalOpen guard at the top of this handler.
      if (event.key === "Escape" && !typing) {
        const st = useEditorStore.getState();
        if (!st.fullscreenPreview) return;
        event.preventDefault();
        st.setFullscreenPreview(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
