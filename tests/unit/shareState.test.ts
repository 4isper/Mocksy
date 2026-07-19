import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initialScene } from "@/lib/state/editorStore";
import { readSceneFromUrl, sceneToShareUrl } from "@/lib/state/shareState";
import type { EditorScene } from "@/lib/types/editor";

const ORIGINAL_WINDOW = globalThis.window;
let currentHref = "https://mocksy.test/";

function stubLocation(href: string) {
  currentHref = href;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { location: { get href() { return currentHref; } } }
  });
}

describe("shareState", () => {
  beforeEach(() => {
    stubLocation("https://mocksy.test/");
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: ORIGINAL_WINDOW
    });
  });

  it("round-trips a scene through a share URL", () => {
    const scene: EditorScene = { ...initialScene, frame: "desktop", zoom: 1.25, watermarkText: "Demo" };
    const url = sceneToShareUrl(scene);
    expect(url).toContain("scene=");
    // sceneToShareUrl derives the URL from window.location.href, so the
    // produced URL must be fed back as the current location for readSceneFromUrl.
    stubLocation(url);
    const restored = readSceneFromUrl();
    expect(restored).not.toBeNull();
    expect(restored?.frame).toBe("desktop");
    expect(restored?.zoom).toBe(1.25);
    expect(restored?.watermarkText).toBe("Demo");
  });

  it("returns null when no scene param is present", () => {
    stubLocation("https://mocksy.test/?other=value");
    expect(readSceneFromUrl()).toBeNull();
  });

  it("returns null for malformed scene param", () => {
    stubLocation("https://mocksy.test/?scene=not-json");
    expect(readSceneFromUrl()).toBeNull();
  });
});
