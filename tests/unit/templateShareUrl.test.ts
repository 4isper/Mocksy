import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { initialScene } from "@/lib/state/editorStore";
import {
  clearTemplateFromUrl,
  readTemplateFromUrl,
  sceneToTemplateUrl
} from "@/lib/state/shareState";
import type { EditorScene } from "@/lib/types/editor";

const ORIGINAL_WINDOW = globalThis.window;
let currentHref = "https://mocksy.test/";
const replaceCalls: string[] = [];

function stubLocation(href: string, withHistory = false) {
  currentHref = href;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { get href() { return currentHref; } },
      ...(withHistory
        ? { history: { replaceState: (_s: unknown, _t: unknown, url: string) => { replaceCalls.push(url); currentHref = url; } } }
        : {})
    }
  });
}

describe("template share URL", () => {
  beforeEach(() => {
    replaceCalls.length = 0;
    stubLocation("https://mocksy.test/");
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: ORIGINAL_WINDOW
    });
  });

  it("round-trips a scene through a compressed ?template= URL", async () => {
    const scene: EditorScene = { ...initialScene, frame: "desktop", watermarkText: "Kit" };
    const url = await sceneToTemplateUrl(scene);
    expect(url).toContain("template=z.");
    stubLocation(url);
    const restored = await readTemplateFromUrl();
    expect(restored?.frame).toBe("desktop");
    expect(restored?.watermarkText).toBe("Kit");
  });

  it("strips every media payload on both write and read", async () => {
    const scene: EditorScene = {
      ...initialScene,
      layers: [{ ...initialScene.layers[0]!, mediaUrl: "data:image/png;base64,SECRET" }],
      backgroundImageUrl: "data:image/jpeg;base64,BG",
      watermarkImageUrl: "data:image/png;base64,LOGO"
    };
    const url = await sceneToTemplateUrl(scene);
    // The secret payload must not appear raw anywhere in the link.
    expect(url).not.toContain("SECRET");
    stubLocation(url);
    const restored = await readTemplateFromUrl();
    expect(restored?.layers[0]?.mediaUrl).toBeNull();
    expect(restored?.backgroundImageUrl).toBeNull();
    expect(restored?.watermarkImageUrl).toBeNull();
  });

  it("returns null without the param and for malformed payloads", async () => {
    stubLocation("https://mocksy.test/?a=1");
    expect(await readTemplateFromUrl()).toBeNull();
    stubLocation("https://mocksy.test/?template=not-json");
    expect(await readTemplateFromUrl()).toBeNull();
    stubLocation("https://mocksy.test/?scene=z.GARBAGE");
    expect(await readTemplateFromUrl()).toBeNull();
  });

  it("clearTemplateFromUrl removes only its own param", () => {
    stubLocation("https://mocksy.test/?template=z.X&scene=y", true);
    clearTemplateFromUrl();
    expect(replaceCalls[0]).toBe("https://mocksy.test/?scene=y");
    // No-op when absent.
    clearTemplateFromUrl();
    expect(replaceCalls).toHaveLength(1);
  });
});
