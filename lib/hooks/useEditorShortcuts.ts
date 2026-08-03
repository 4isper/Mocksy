import { useEffect, useRef } from "react";
import { useEditorStore } from "@/lib/state/editorStore";

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
  isModalOpen: () => boolean;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
}

/**
 * Global editor keyboard shortcuts: ⌘K command palette, ⌘Z/⌘⇧Z/⌘Y undo/redo,
 * ⌘N new project, ⌘S save, ⌘E/⌘⇧E/⇧⌘G/⇧⌘W/⇧⌘P/⌘⇧A/⌘⇧S/⌘⇧H/⌘⇧F exports,
 * ⌘⇧C clipboard copy, ⌘D duplicate layer, ⌘↑/⌘↓/⌘[/⌘] layer order, plain
 * arrow keys nudge frames, "?" cheat sheet, "R" reset. Actions are read
 * through a ref so the window listener is bound once and never needs
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
      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        a.onOpenCommandPalette();
        return;
      }
      if (modifier && event.key.toLowerCase() === "z") {
        event.preventDefault();
        const st = useEditorStore.getState();
        if (event.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (modifier && event.key.toLowerCase() === "y") {
        event.preventDefault();
        useEditorStore.getState().redo();
        return;
      }
      // ⌘⇧S exports SVG — must be checked before the plain ⌘S save handler.
      if (modifier && event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        a.onExportSvg();
        return;
      }
      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        a.saveNow();
        return;
      }
      if (modifier && !event.shiftKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        a.onNewProject();
        return;
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === "w") {
        event.preventDefault();
        a.onExportWebm();
        return;
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        a.onExportWebp();
        return;
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        a.onExportWebpAnim();
        return;
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === "h") {
        event.preventDefault();
        a.onExportHtml();
        return;
      }
      // ⌘⇧F exports PDF (F as in File/PDF; ⌘⇧P is taken by WebP).
      if (modifier && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        a.onExportPdf();
        return;
      }
      if (modifier && !event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        a.onExportPng();
        return;
      }
      // ⌘⇧E exports MP4, ⌘⇧G exports GIF (the GIF module is
      // still loaded lazily, via the same dynamic import as MP4).
      if (modifier && event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        a.onExportMp4();
        return;
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === "g") {
        event.preventDefault();
        a.onExportGif();
        return;
      }
      // ⌘⇧C copies a PNG snapshot to the clipboard (⌘C alone stays
      // free for normal text copy while typing in a field).
      if (modifier && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        a.onCopyPng();
        return;
      }
      // Layer shortcuts: ⌘D duplicates the active layer, ⌘↑/⌘↓ move it.
      // Skip while typing in a field so they don't hijack text editing.
      if (modifier && !typing && event.key.toLowerCase() === "d") {
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
      if (modifier && !typing && (event.key === "[" || event.key === "]")) {
        event.preventDefault();
        const st = useEditorStore.getState();
        const ids = st.scene.layers.map((l) => l.id);
        const idx = ids.indexOf(st.activeLayerId ?? st.scene.layers[0]?.id ?? "");
        if (idx < 0) return;
        const dir = event.key === "[" ? -1 : 1;
        const nextIdx = Math.max(0, Math.min(ids.length - 1, idx + dir));
        const id = ids[nextIdx];
        if (id) st.selectLayer(id);
        return;
      }
      // Arrow keys nudge the selected frame instance on the canvas.
      if (!modifier && !typing && event.key.startsWith("Arrow")) {
        event.preventDefault();
        const st = useEditorStore.getState();
        let id = st.activeFrameInstanceId;
        if (!id && st.scene.frameInstances.length > 0) {
          id = st.scene.frameInstances[0]!.id;
          st.selectFrameInstance(id);
        }
        const inst = st.scene.frameInstances.find((fi) => fi.id === id);
        if (!inst) return;
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
      if (event.key.toLowerCase() === "r" && !modifier) {
        if (typing) return;
        event.preventDefault();
        a.onReset();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
