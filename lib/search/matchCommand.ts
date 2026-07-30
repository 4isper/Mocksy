import type { Command } from "@/lib/types/editor";

export function matchQuery(command: Command, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const haystack = [command.label, command.description, ...command.keywords]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
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
