import { describe, expect, it } from "vitest";
import { DEMO_MEDIA_NAME, DEMO_MEDIA_URL } from "@/lib/media/demoMedia";

describe("demoMedia", () => {
  it("exposes an inline SVG data URI", () => {
    expect(DEMO_MEDIA_URL.startsWith("data:image/svg+xml")).toBe(true);
    const decoded = decodeURIComponent(DEMO_MEDIA_URL.replace(/^data:image\/svg\+xml;utf8,/, ""));
    expect(decoded).toContain("<svg");
    expect(decoded).toContain("</svg>");
  });

  it("names the demo asset", () => {
    expect(DEMO_MEDIA_NAME).toBe("mocksy-demo.svg");
  });
});
