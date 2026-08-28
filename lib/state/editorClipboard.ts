/** Editor-internal object clipboard for ⌘C/⌘V of the selected annotation,
 *  frame instance or media layer. Intentionally not the OS clipboard: copies
 *  reference scene objects by id, and paste re-duplicates from the live scene
 *  (so undo, ids and layer cloning all reuse the existing store actions). */

export type CopiedObject =
  | { kind: "annotation"; id: string }
  | { kind: "frameInstance"; id: string }
  | { kind: "layer"; id: string };

let copied: CopiedObject | null = null;

export function setCopiedObject(entry: CopiedObject | null): void {
  copied = entry;
}

export function getCopiedObject(): CopiedObject | null {
  return copied;
}
