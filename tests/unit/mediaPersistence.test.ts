import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { EditorScene, Project } from "@/lib/types/editor";
import { initialScene } from "@/lib/state/editorStore";

import { createFakeIndexedDB, FakeFileReader, type FakeIdbHandle } from "./helpers/fakeIdb";

const ORIGINAL_WINDOW = globalThis.window;
const ORIGINAL_FILE_READER = globalThis.FileReader;

let idb: FakeIdbHandle;

beforeEach(() => {
  idb = createFakeIndexedDB();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { indexedDB: idb }
  });
  globalThis.FileReader = FakeFileReader as unknown as typeof FileReader;
});

afterEach(() => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: ORIGINAL_WINDOW
  });
  globalThis.FileReader = ORIGINAL_FILE_READER;
});

const BIG_DATA_URL_PREFIX = "data:image/png;base64,";

describe("media persistence codec", () => {
  it("offloads large data URLs to IndexedDB and restores them on decode", async () => {
    const { encodeProjectsState, decodeProjectsState } = await import("@/lib/state/mediaPersistence");
    const big = makeBigDataUrl("a");
    const state = { projects: [makeProject(makeScene(big))], activeProjectId: "p1" };

    const json = await encodeProjectsState(state);
    expect(json).not.toBeNull();
    // The payload itself must NOT travel inside localStorage JSON…
    expect(json).not.toContain(big.slice(0, 100));
    // …and is far smaller than the inline equivalent.
    expect(json!.length).toBeLessThan(big.length / 2);

    const decoded = await decodeProjectsState(json);
    expect(decoded?.projects[0]?.scene.layers[0]?.mediaUrl).toBe(big);
  });

  it("dedupes identical payloads across layers into a single blob", async () => {
    const { encodeProjectsState } = await import("@/lib/state/mediaPersistence");
    const big = makeBigDataUrl("b");
    const scene = makeScene(big);
    scene.layers = [
      { ...scene.layers[0]!, id: "l1", mediaUrl: big },
      { ...scene.layers[0]!, id: "l2", mediaUrl: big }
    ];
    await encodeProjectsState({ projects: [makeProject(scene)], activeProjectId: "p1" });

    // One content-hash key, not two copies.
    expect([...idb._store.keys()].length).toBe(1);
  });

  it("keeps small data URLs inline", async () => {
    const { encodeProjectsState } = await import("@/lib/state/mediaPersistence");
    const tiny = "data:image/png;base64,iVBORw0KGgo=";
    const json = await encodeProjectsState({ projects: [makeProject(makeScene(tiny))], activeProjectId: "p1" });
    expect(json).toContain(tiny);
    expect(idb._store.size).toBe(0);
  });

  it("reports failure (null) when IndexedDB is unavailable so persist stays inline", async () => {
    const { encodeProjectsState } = await import("@/lib/state/mediaPersistence");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {} // no indexedDB
    });
    const json = await encodeProjectsState({
      projects: [makeProject(makeScene(makeBigDataUrl("c")))],
      activeProjectId: "p1"
    });
    // null tells the caller to write the legacy fully-inline JSON instead of
    // storing placeholders whose blobs were never saved.
    expect(json).toBeNull();
  });

  it("degrades a missing blob to null media instead of a dead reference", async () => {
    const { encodeProjectsState, decodeProjectsState } = await import("@/lib/state/mediaPersistence");
    const json = await encodeProjectsState({
      projects: [makeProject(makeScene(makeBigDataUrl("d")))],
      activeProjectId: "p1"
    });
    // Simulate manual IndexedDB eviction.
    idb._store.clear();

    const decoded = await decodeProjectsState(json);
    expect(decoded?.projects[0]?.scene.layers[0]?.mediaUrl).toBeNull();
  });

  it("sweeps orphaned blobs that no project references anymore", async () => {
    const { encodeProjectsState, sweepOrphanedMedia, decodeProjectsState } = await import("@/lib/state/mediaPersistence");
    const keep = makeBigDataUrl("e");
    await encodeProjectsState({ projects: [makeProject(makeScene(keep))], activeProjectId: "p1" });

    // A second, now-unreferenced blob.
    const orphan = makeBigDataUrl("f");
    const orphanJson = await encodeProjectsState({
      projects: [makeProject(makeScene(orphan))],
      activeProjectId: "p1"
    });
    const orphanKey = (orphanJson!.match(/@idb:[a-f0-9]+/) ?? [""])[0].slice(5);
    expect(idb._store.has(orphanKey)).toBe(true);

    const state = await decodeProjectsState(
      (
        await encodeProjectsState({ projects: [makeProject(makeScene(keep))], activeProjectId: "p1" })
      )!
    );
    const removed = await sweepOrphanedMedia(state);
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(idb._store.has(orphanKey)).toBe(false);
    // The referenced blob survives the sweep.
    const decodedKeep = await decodeProjectsState(
      (await encodeProjectsState({ projects: [makeProject(makeScene(keep))], activeProjectId: "p1" }))!
    );
    expect(decodedKeep?.projects[0]?.scene.layers[0]?.mediaUrl).toBe(keep);
  });

  it("keeps in-flight offload blobs referenced during a sweep (persist write race)", async () => {
    const { encodeProjectsState, sweepOrphanedMedia, beginMediaOffload, endMediaOffload } = await import("@/lib/state/mediaPersistence");
    // The blob lands in IndexedDB, but persist hasn't committed its
    // placeholder to localStorage yet — the exact window the sweep races.
    const big = makeBigDataUrl("r");
    const json = await encodeProjectsState({ projects: [makeProject(makeScene(big))], activeProjectId: "p1" });
    const key = (json!.match(/@idb:[a-f0-9]+/) ?? [""])[0].slice(5);
    expect(idb._store.has(key)).toBe(true);
    beginMediaOffload([key]);

    // Sweeping against a pre-offload decoded state and a raw snapshot without
    // the placeholder must not treat the fresh blob as an orphan.
    const removed = await sweepOrphanedMedia(null, () => "{}");
    expect(removed).toBe(0);
    expect(idb._store.has(key)).toBe(true);

    // Once the write commits (endMediaOffload), the key is a true orphan again.
    endMediaOffload([key]);
    const removedAfter = await sweepOrphanedMedia(null, () => "{}");
    expect(removedAfter).toBe(1);
    expect(idb._store.has(key)).toBe(false);
  });
  it("does not mutate the caller's scenes while encoding", async () => {
    const { encodeProjectsState } = await import("@/lib/state/mediaPersistence");
    const big = makeBigDataUrl("m");
    const frameAsset = makeBigDataUrl("n");
    const scene = {
      ...makeScene(big),
      customFrame: {
        id: "cf1",
        asset: frameAsset,
        name: "Custom",
        viewBox: { w: 100, h: 200 },
        cutout: { x: 10, y: 10, w: 80, h: 180, rx: 4 }
      }
    };
    const other = makeScene(makeBigDataUrl("o"));
    const state = {
      projects: [makeProject(scene), { ...makeProject(other), id: "p2" }],
      activeProjectId: "p1"
    };

    const json = await encodeProjectsState(state);
    expect(json).toContain("@idb:");
    // Live state (editor scene, undo history, non-active projects) shares these
    // objects — in-place placeholder substitution would break their previews.
    expect(scene.layers[0]!.mediaUrl).toBe(big);
    expect(other.layers[0]!.mediaUrl).not.toContain("@idb:");
    expect(scene.customFrame?.asset).toBe(frameAsset);
  });
});

function makeBigDataUrl(fill: string, kb = 96): string {
  const bytes = new Uint8Array(kb * 1024).fill(fill.charCodeAt(0));
  return BIG_DATA_URL_PREFIX + Buffer.from(bytes).toString("base64");
}

function makeScene(mediaUrl: string): EditorScene {
  return {
    ...initialScene,
    layers: [{ ...initialScene.layers[0]!, id: "l1", mediaUrl, mediaName: "shot.png" }],
    activeLayerId: "l1"
  };
}

function makeProject(scene: EditorScene): Project {
  return { id: "p1", name: "P1", scene, updatedAt: 1 };
}
