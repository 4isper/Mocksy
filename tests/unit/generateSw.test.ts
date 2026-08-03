import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const template = readFileSync(new URL("../../scripts/sw-template.js", import.meta.url), "utf8");
const sw = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");

describe("sw.js build-time cache version", () => {
  it("stamps a versioned cache name into the generated file", () => {
    expect(template).toContain("mocksy-sw-__SW_VERSION__");
    const match = sw.match(/const CACHE = "(mocksy-sw-[0-9a-z]+)"/);
    expect(match).not.toBeNull();
  });

  it("leaves no placeholder in the generated file", () => {
    expect(sw).not.toContain("__SW_VERSION__");
  });

  it("matches the template apart from the stamped version", () => {
    const match = sw.match(/mocksy-sw-([0-9a-z]+)"/);
    const version = match?.[1];
    expect(version).toBeDefined();
    const restored = sw.replaceAll(version!, "__SW_VERSION__");
    expect(restored).toBe(template);
  });
});
