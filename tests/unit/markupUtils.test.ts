import { describe, expect, it } from "vitest";
import { escapeMarkup, round2 } from "@/lib/export/markupUtils";

describe("round2", () => {
  it("rounds to two decimals as a string", () => {
    expect(round2(3.14159)).toBe("3.14");
    expect(round2(100)).toBe("100");
    expect(round2(0.5)).toBe("0.5");
    expect(round2(2.005)).toBe("2.01");
  });
});

describe("escapeMarkup", () => {
  it("escapes the five XML/HTML special characters", () => {
    expect(escapeMarkup(`<a href="x">& 'y'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp; &apos;y&apos;&lt;/a&gt;");
  });

  it("leaves plain text untouched", () => {
    expect(escapeMarkup("Hello, Mocksy!")).toBe("Hello, Mocksy!");
  });

  it("matches the previous HTML and SVG escaping behavior", () => {
    // Both old escapeHtml and escapeXml covered these cases.
    expect(escapeMarkup("Tom & Jerry")).toBe("Tom &amp; Jerry");
    expect(escapeMarkup('say "hi"')).toBe("say &quot;hi&quot;");
    expect(escapeMarkup("it's")).toBe("it&apos;s");
  });
});
