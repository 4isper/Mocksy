import type { Command } from "@/lib/types/editor";

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

export function matchQuery(command: Command, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [command.label, command.description, ...command.keywords]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

/** Splits `text` into segments marking which parts match `query` (case-insensitive),
 *  so callers can highlight the matched substring in a command label. */
export function highlightMatch(text: string, query: string): HighlightSegment[] {
  if (!text) return [];
  if (!query) return [{ text, matched: false }];
  const q = query.toLowerCase();
  const lower = text.toLowerCase();
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  let idx = lower.indexOf(q);
  while (idx !== -1) {
    if (idx > cursor) segments.push({ text: text.slice(cursor, idx), matched: false });
    segments.push({ text: text.slice(idx, idx + q.length), matched: true });
    cursor = idx + q.length;
    idx = lower.indexOf(q, cursor);
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), matched: false });
  return segments;
}

export function scoreMatch(command: Command, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const label = command.label.toLowerCase();
  const desc = command.description?.toLowerCase() || "";

  if (label.startsWith(q)) return 100;
  if (label.includes(q)) return 50;
  if (desc.includes(q)) return 25;
  if (command.keywords.some(k => k.toLowerCase().includes(q))) return 10;
  return 0;
}
