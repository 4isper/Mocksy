import { describe, expect, it } from "vitest";
import { POST, OPTIONS } from "@/app/api/spin/route";

describe("POST /api/spin", () => {
  it("spins a scene with media and returns a seed", async () => {
    const res = await POST(new Request("http://localhost/api/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pack: { frames: [{ id: "iphone" }], backgrounds: [{ id: "sunset" }] },
        media: "data:image/png;base64,iVBORw0KGgo=",
        seed: 42
      })
    }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    const body = await res.json();
    expect(body.seed).toBe(42);
    expect(body.scene.frame).toBe("iphone");
    expect(body.scene.layers[0].mediaUrl).toBe("data:image/png;base64,iVBORw0KGgo=");
  });

  it("rejects non-data media URLs", async () => {
    const res = await POST(new Request("http://localhost/api/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media: "https://example.com/img.png", seed: 1 })
    }));
    expect(res.status).toBe(400);
  });

  it("rejects oversized media", async () => {
    const res = await POST(new Request("http://localhost/api/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media: `data:image/png;base64,${"A".repeat(40 * 1024 * 1024)}`, seed: 1 })
    }));
    expect(res.status).toBe(413);
  });

  it("rejects malformed JSON", async () => {
    const res = await POST(new Request("http://localhost/api/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json"
    }));
    expect(res.status).toBe(400);
  });

  it("rejects a non-numeric seed instead of coercing it", async () => {
    const res = await POST(new Request("http://localhost/api/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: "banana" })
    }));
    expect(res.status).toBe(400);
  });

  it("rejects a request whose body exceeds the byte budget", async () => {
    // Content-Length above MAX_BODY_BYTES is rejected before parsing; the
    // oversized media payload (40MB base64) also crosses the line while
    // streaming, exercising both guards.
    const res = await POST(new Request("http://localhost/api/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media: `data:image/png;base64,${"A".repeat(40 * 1024 * 1024)}`, seed: 1 })
    }));
    expect(res.status).toBe(413);
  });

  it("rejects an oversized Content-Length without reading the body", async () => {
    const res = await POST(new Request("http://localhost/api/spin", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Undersized body, inflated Content-Length: only the header guard can
        // catch this without buffering anything.
        "Content-Length": String(50 * 1024 * 1024)
      },
      body: JSON.stringify({ seed: 1 })
    }));
    expect(res.status).toBe(413);
  });

  it("rejects a null body", async () => {
    const res = await POST(new Request("http://localhost/api/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(null)
    }));
    expect(res.status).toBe(400);
  });

  it("spins without media using the demo layer", async () => {
    const res = await POST(new Request("http://localhost/api/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: 7 })
    }));
    const body = await res.json();
    expect(body.scene.layers.length).toBeGreaterThan(0);
    expect(typeof body.seed).toBe("number");
  });

  it("treats video mediaType as video", async () => {
    const res = await POST(new Request("http://localhost/api/spin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        media: "data:video/mp4;base64,AAAA",
        mediaType: "video",
        seed: 3
      })
    }));
    const body = await res.json();
    expect(body.scene.layers[0].mediaType).toBe("video");
  });
});

describe("OPTIONS /api/spin", () => {
  it("answers a CORS preflight", async () => {
    const res = await OPTIONS();
    expect(res.status).toBe(204);
    expect(res.headers.get("Allow")).toContain("POST");
  });
});
