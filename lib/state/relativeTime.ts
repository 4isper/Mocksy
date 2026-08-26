/** Formats a timestamp as a relative "x minutes/hours/days ago" string. `now`
 *  is injected so callers can refresh it on an interval without re-rendering
 *  every row, and unit tests can pass a fixed reference. */
export function relativeTime(ts: number, now: number, t: (key: string, vars?: Record<string, unknown>) => string): string {
  const diff = now - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("projects.justNow");
  if (min < 60) return t("projects.minAgo", { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t("projects.hourAgo", { n: hr });
  const day = Math.floor(hr / 24);
  return t("projects.dayAgo", { n: day });
}
