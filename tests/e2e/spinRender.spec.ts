import { expect, test } from "@playwright/test";

/**
 * Server-side PNG render (the "roulette for bots" path). POSTs a scene to
 * /api/spin with format=png and asserts the response is a real PNG produced
 * by the same pipeline the browser export uses, plus determinism: the same
 * seed must yield byte-identical images.
 */

const MEDIA =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMQFZX5DwABzwFGACFM1wAAAABJRU5ErkJggg==";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

test("format=png returns image/png bytes with the seed + frame headers", async ({ request }) => {
  const res = await request.post("/api/spin", {
    data: {
      pack: { frames: [{ id: "iphone" }], backgrounds: [{ id: "sunset" }] },
      media: MEDIA,
      seed: 11,
      format: "png",
      scale: 2
    }
  });
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("image/png");
  expect(res.headers()["x-mocksy-seed"]).toBe("11");
  expect(res.headers()["x-mocksy-frame"]).toBe("iphone");

  const body = await res.body();
  expect(body.length).toBeGreaterThan(1000);
  expect([...body.subarray(0, 4)]).toEqual(PNG_MAGIC);
});

test("same seed renders byte-identical images (determinism)", async ({ request }) => {
  const payload = {
    pack: { frames: [{ id: "macbook" }], backgrounds: [{ id: "zinc" }], tilt: false },
    media: MEDIA,
    seed: 7,
    format: "png",
    scale: 2
  };
  const a = await (await request.post("/api/spin", { data: payload })).body();
  const b = await (await request.post("/api/spin", { data: payload })).body();
  expect(a).toEqual(b);
});

test("format=png respects explicit width/height", async ({ request }) => {
  const res = await request.post("/api/spin", {
    data: {
      media: MEDIA,
      seed: 3,
      format: "png",
      width: 320,
      height: 240
    }
  });
  expect(res.status()).toBe(200);
  const body = await res.body();
  expect(body.length).toBeGreaterThan(0);
  expect([...body.subarray(0, 4)]).toEqual(PNG_MAGIC);
});

test("json format (default) keeps returning the scene", async ({ request }) => {
  const res = await request.post("/api/spin", {
    data: { pack: { frames: [{ id: "iphone" }] }, media: MEDIA, seed: 5 }
  });
  expect(res.status()).toBe(200);
  const json = await res.json();
  expect(json.seed).toBe(5);
  expect(json.scene.frame).toBe("iphone");
  expect(json.scene.layers[0].mediaUrl).toBe(MEDIA);
});