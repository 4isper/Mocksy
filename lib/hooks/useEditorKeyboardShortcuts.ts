"use client";

import { useEffect, useRef } from "react";
import { useEditorStore } from "@/lib/state/editorStore";

export function useEditorKeyboardShortcuts(
  hasOpenModalRef: React.MutableRefObject<boolean>,
  saveNow: () => void,
  handleReset: () => void,
  handleExportPng: () => void,
  handleExportMp4: () => void,
  handleExportGif: () => void,
  handleCopyPng: () => void,
  setShortcutsOpen: (v: boolean) => void,
  setCommandPaletteOpen: (v: boolean) => void,
) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      const target = event.target as HTMLElement | null;
      const typing =
        !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
      if (hasOpenModalRef.current) return;
      if ((event.key === "?" || (event.code === "Slash" && event.shiftKey)) && !typing) {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (modifier && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
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
      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        saveNow();
        return;
      }
      if (modifier && !event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        handleExportPng();
        return;
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === "e") {
        event.preventDefault();
        handleExportMp4();
        return;
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === "g") {
        event.preventDefault();
        handleExportGif();
        return;
      }
      if (modifier && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        handleCopyPng();
        return;
      }
      if (modifier && !typing && event.key.toLowerCase() === "d") {
        event.preventDefault();
        const st = useEditorStore.getState();
        const id = st.scene.activeLayerId ?? st.scene.layers[0]?.id;
        if (id) st.duplicateLayer(id);
        return;
      }
      if (modifier && !typing && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const st = useEditorStore.getState();
        const ids = st.scene.layers.map((l) => l.id);
        const idx = ids.indexOf(st.scene.activeLayerId ?? st.scene.layers[0]?.id ?? "");
        const dir = event.key === "ArrowUp" ? -1 : 1;
        const next = idx + dir;
        if (idx < 0 || next < 0 || next >= ids.length) return;
        const a = ids[idx];
        const b = ids[next];
        if (a === undefined || b === undefined) return;
        ids[idx] = b;
        ids[next] = a;
        st.reorderLayers(ids);
        return;
      }
      if (modifier && !typing && (event.key === "[" || event.key === "]")) {
        event.preventDefault();
        const st = useEditorStore.getState();
        const ids = st.scene.layers.map((l) => l.id);
        const idx = ids.indexOf(st.scene.activeLayerId ?? st.scene.layers[0]?.id ?? "");
        if (idx < 0) return;
        const dir = event.key === "[" ? -1 : 1;
        const nextIdx = Math.max(0, Math.min(ids.length - 1, idx + dir));
        const id = ids[nextIdx];
        if (id) st.selectLayer(id);
        return;
      }
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
        handleReset();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [saveNow, handleReset, handleExportPng, handleExportMp4, handleExportGif, handleCopyPng, setShortcutsOpen, setCommandPaletteOpen]);
}
