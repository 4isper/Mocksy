import { useEffect, useRef } from "react";
import { useEditorStore } from "@/lib/state/editorStore";
import { getCopiedObject, setCopiedObject } from "@/lib/state/editorClipboard";
import { useShortcutsStore, effectiveCombo } from "@/lib/state/shortcutsStore";
import { SHORTCUT_DEFS, eventMatchesCombo, eventLetter, eventBracket } from "@/lib/shortcuts/shortcutConfig";
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

type ActionMap = {
  [id: string]: (a: EditorShortcutActions) => boolean | void;
};

/**
 * Per-shortcut handlers keyed by def id. Returning false means "not handled"
 * — the caller skips preventDefault so e.g. ⌘C with nothing copyable keeps
 * the native browser behavior.
 */
const HANDLERS: ActionMap = {
  "open-command-palette": (a) => (a.onOpenCommandPalette(), true),
  "new-project": (a) => (a.onNewProject(), true),
  "save-project": (a) => (a.saveNow(), true),
  undo: () => (useEditorStore.getState().undo(), true),
  redo: () => (useEditorStore.getState().redo(), true),
  "export-png": (a) => (a.onExportPng(), true),
  "copy-png": (a) => (a.onCopyPng(), true),
  "export-mp4": (a) => (a.onExportMp4(), true),
  "export-webm": (a) => (a.onExportWebm(), true),
  "export-webp": (a) => (a.onExportWebp(), true),
  "export-webp-anim": (a) => (a.onExportWebpAnim(), true),
  "export-svg": (a) => (a.onExportSvg(), true),
  "export-html": (a) => (a.onExportHtml(), true),
  "export-pdf": (a) => (a.onExportPdf(), true),
  "export-gif": (a) => (a.onExportGif(), true),
  "duplicate-layer": () => {
    const st = useEditorStore.getState();
    const id = st.activeLayerId ?? st.scene.layers[0]?.id;
    if (!id) return false;
    st.duplicateLayer(id);
    return true;
  },
  "move-layer-up": () => moveLayer(-1),
  "move-layer-down": () => moveLayer(1),
  "select-prev-layer": () => cycleSelection(-1),
  "select-next-layer": () => cycleSelection(1),
  // ⌘C copies the selected annotation, frame instance or active layer onto
  // the editor's internal object clipboard (⌘⇧C above is the PNG copy).
  // Pasting happens in useClipboardPaste's window paste handler so OS
  // clipboard media always wins over object paste on ⌘V.
  "copy-object": () => {
    const st = useEditorStore.getState();
    const annId = st.selectedAnnotationId;
    const frameId = st.activeFrameInstanceId;
    const layerId = st.activeLayerId ?? st.scene.layers[0]?.id;
    if (annId) setCopiedObject({ kind: "annotation", id: annId });
    else if (frameId) setCopiedObject({ kind: "frameInstance", id: frameId });
    else if (layerId) setCopiedObject({ kind: "layer", id: layerId });
    else return false;
    return true;
  },
  "go-layers": () => { const st = useEditorStore.getState(); st.setFullscreenPreview(false); st.setRightTab("layers"); return true; },
  "go-annotations": () => { const st = useEditorStore.getState(); st.setFullscreenPreview(false); st.setRightTab("annotations"); return true; },
  "go-history": () => { const st = useEditorStore.getState(); st.setFullscreenPreview(false); st.setRightTab("history"); return true; }
};

function moveLayer(dir: -1 | 1): boolean {
  const st = useEditorStore.getState();
  const ids = st.scene.layers.map((l) => l.id);
  const idx = ids.indexOf(st.activeLayerId ?? st.scene.layers[0]?.id ?? "");
  const next = idx + dir;
  if (idx < 0 || next < 0 || next >= ids.length) return false;
  const firstId = ids[idx];
  const secondId = ids[next];
  if (firstId === undefined || secondId === undefined) return false;
  ids[idx] = secondId;
  ids[next] = firstId;
  st.reorderLayers(ids);
  return true;
}

function cycleSelection(dir: -1 | 1): boolean {
  const st = useEditorStore.getState();
  const ids = st.scene.layers.map((l) => l.id);
  const idx = ids.indexOf(st.activeLayerId ?? st.scene.layers[0]?.id ?? "");
  if (idx < 0) return false;
  const nextIdx = Math.max(0, Math.min(ids.length - 1, idx + dir));
  const id = ids[nextIdx];
  if (!id) return false;
  st.selectLayer(id);
  return true;
}

/**
 * Global editor keyboard shortcuts, driven by SHORTCUT_DEFS (single source of
 * truth shared with the cheat-sheet dialog) plus user overrides persisted in
 * shortcutsStore. Fixed behaviors (? help, preview zoom, plain-arrow frame
 * nudge, R reset, F full-screen, Esc exit) stay hardcoded. Actions are read
 * through a ref so the window listener is bound once and never needs
 * re-subscribing; overrides are read per-event from the store so rebinding
 * applies instantly without re-binding the listener.
 */
export function useEditorShortcuts(actions: EditorShortcutActions): void {
  const actionsRef = useRef(actions);
  useEffect(() => {
    actionsRef.current = actions;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const a = actionsRef.current;
      const typing = isTypingTarget(event.target);
      // Skip shortcuts when a modal dialog is open.
      if (a.isModalOpen()) return;

      // ? opens the cheat sheet (fixed, not remappable).
      if ((event.key === "?" || (event.code === "Slash" && event.shiftKey)) && !typing) {
        event.preventDefault();
        a.onOpenShortcuts();
        return;
      }

      // Remappable table + fixed view-zoom combos, evaluated against the
      // effective (possibly overridden) bindings.
      const { overrides } = useShortcutsStore.getState();
      const letter = eventLetter(event);
      const bracket = eventBracket(event);

      for (const def of SHORTCUT_DEFS) {
        const combo = effectiveCombo(def, overrides);
        if (!eventMatchesCombo(event, letter, bracket, combo)) continue;

        const handler = HANDLERS[def.id];
        // Defs without a table entry here are display-only (paste, reset,
        // full-screen…): their behavior lives in the fixed handlers below or
        // in dedicated listeners, so keep matching.
        if (!handler) continue;

        // Historical semantics: some shortcuts intentionally fire while
        // typing (⌘Z, ⌘S…), others must not hijack input fields.
        if (!def.allowWhileTyping && typing) return;

        const handled = handler(a);
        if (handled) {
          event.preventDefault();
          return;
        }
        // Not handled (e.g. ⌘C with nothing to copy): fall through so the
        // browser's native behavior survives.
      }

      // Preview view zoom: fixed physical-code matching so numpad and layout
      // variants work; these shadow the browser's page zoom.
      if (event.metaKey || event.ctrlKey) {
        // ⌘Y is a long-standing redo alias kept for muscle memory.
        if (letter === "y" && !event.shiftKey) {
          event.preventDefault();
          useEditorStore.getState().redo();
          return;
        }
        if (!typing && !event.shiftKey && (event.code === "Equal" || event.key === "=" || event.key === "+")) {
          event.preventDefault();
          zoomPreview(1);
          return;
        }
        if (!typing && (event.code === "Minus" || event.key === "-")) {
          event.preventDefault();
          zoomPreview(-1);
          return;
        }
        if (!typing && (event.code === "Digit0" || event.key === "0")) {
          event.preventDefault();
          useEditorStore.getState().resetPreviewView();
          return;
        }
      }

      // Plain arrow keys nudge the selected frame instance on the canvas.
      if (!(event.metaKey || event.ctrlKey) && !typing && event.key.startsWith("Arrow")) {
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

      // R resets (opens the confirm dialog via actions).
      if (letter === "r" && !(event.metaKey || event.ctrlKey)) {
        if (typing) return;
        event.preventDefault();
        a.onReset();
        return;
      }
      // F toggles the full-screen preview (plain key, like R). Skipped while
      // typing so it can't hijack text fields; ⌘⇧F (PDF export) matched the
      // table earlier because of its modifier.
      if (letter === "f" && !(event.metaKey || event.ctrlKey) && !typing) {
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
