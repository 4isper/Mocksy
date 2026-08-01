import { describe, expect, it } from "vitest";
import { matchQuery, scoreMatch } from "@/lib/search/matchCommand";
import type { Command } from "@/lib/types/editor";

const command: Command = {
  id: "export-png",
  label: "Export PNG",
  description: "Download a PNG image",
  keywords: ["png", "image", "download", "picture"],
  action: () => {}
};

describe("matchQuery", () => {
  it("matches everything on an empty query", () => {
    expect(matchQuery(command, "")).toBe(true);
  });

  it("matches the label case-insensitively", () => {
    expect(matchQuery(command, "export")).toBe(true);
    expect(matchQuery(command, "EXPORT")).toBe(true);
  });

  it("matches the description", () => {
    expect(matchQuery(command, "download a png")).toBe(true);
  });

  it("matches a keyword", () => {
    expect(matchQuery(command, "image")).toBe(true);
  });

  it("does not match unrelated queries", () => {
    expect(matchQuery(command, "video")).toBe(false);
  });
});

describe("scoreMatch", () => {
  it("scores 0 on an empty query", () => {
    expect(scoreMatch(command, "")).toBe(0);
  });

  it("scores a prefix label match highest", () => {
    expect(scoreMatch(command, "export")).toBe(100);
  });

  it("scores a substring label match below a prefix", () => {
    expect(scoreMatch(command, "png")).toBe(50);
  });

  it("scores a description match", () => {
    expect(scoreMatch(command, "download")).toBe(25);
  });

  it("scores a keyword match lowest", () => {
    expect(scoreMatch(command, "picture")).toBe(10);
  });

  it("returns 0 when nothing matches", () => {
    expect(scoreMatch(command, "video")).toBe(0);
  });

  it("falls back through description and keywords when the label misses", () => {
    const bare: Command = { id: "x", label: "Foo Bar", keywords: [], action: () => {} };
    expect(scoreMatch(bare, "description text")).toBe(0);
    expect(scoreMatch({ ...command, description: undefined }, "png")).toBe(50);
  });
});
