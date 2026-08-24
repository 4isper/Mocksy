const counters: Record<string, number> = {};

function makeId(prefix: string): string {
  const n = (counters[prefix] ?? 0) + 1;
  counters[prefix] = n;
  return `${prefix}-${n}-${Date.now().toString(36)}`;
}

/** 1-based count of ids already generated for a prefix (e.g. for color cycling). */
export function countOf(prefix: string): number {
  return counters[prefix] ?? 0;
}

export function nextLayerId(): string {
  return makeId("layer");
}

export function nextAnnotationId(): string {
  return makeId("anno");
}

export function nextFrameInstanceId(): string {
  return makeId("frame");
}

export function nextProjectId(): string {
  return makeId("proj");
}
