import { describe, expect, it } from "vitest";
import { relativeTime } from "@/lib/utils/relativeTime";

const t = (key: string, vars?: Record<string, unknown>) => {
  const n = (vars?.n as number | undefined) ?? 0;
  if (key === "projects.justNow") return "just now";
  if (key === "projects.minAgo") return `${n}m ago`;
  if (key === "projects.hourAgo") return `${n}h ago`;
  return `${n}d ago`;
};

const NOW = 1_000_000_000_000;

describe("relativeTime", () => {
  it("returns just now under a minute", () => {
    expect(relativeTime(NOW - 30_000, NOW, t)).toBe("just now");
  });

  it("formats minutes under an hour", () => {
    expect(relativeTime(NOW - 5 * 60_000, NOW, t)).toBe("5m ago");
  });

  it("formats hours under a day", () => {
    expect(relativeTime(NOW - 2 * 3_600_000, NOW, t)).toBe("2h ago");
  });

  it("formats days otherwise", () => {
    expect(relativeTime(NOW - 3 * 86_400_000, NOW, t)).toBe("3d ago");
  });
});
