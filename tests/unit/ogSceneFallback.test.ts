import { describe, expect, it, vi } from "vitest";
import { buildOgScene } from "@/lib/state/ogScene";

// Force the frame-aspect fallback branch (frameInstAr returns null) so the
// `?? 390 / 844` defensive default in buildOgScene is exercised.
vi.mock("@/lib/render/frames", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/render/frames")>()),
  frameInstAr: vi.fn(() => null)
}));

describe("buildOgScene aspect fallback", () => {
  it("uses the portrait fallback when the frame AR is unknown", () => {
    const s = buildOgScene();
    expect(s.frameInstances).toHaveLength(2);
    for (const inst of s.frameInstances) {
      expect(inst.scale).toBeGreaterThan(0);
      expect(Number.isFinite(inst.scale)).toBe(true);
    }
  });
});
