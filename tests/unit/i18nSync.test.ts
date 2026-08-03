import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { leafPaths, main, runCliSync, syncLocale, syncMessagesDir } from "@/scripts/i18n-sync.mjs";

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "i18n-sync.mjs");

const EN = { editor: { undo: "Undo", grid: "Grid" }, nav: { home: "Home" } };

function tempMessagesDir(ru: Record<string, unknown>): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), "i18n-sync-"));
  const messages = path.join(dir, "messages");
  mkdirSync(messages);
  writeFileSync(path.join(messages, "en.json"), `${JSON.stringify(EN, null, 2)}\n`);
  writeFileSync(path.join(messages, "ru.json"), `${JSON.stringify(ru, null, 2)}\n`);
  return dir;
}

function readLocale(dir: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(dir, "messages", "ru.json"), "utf-8")) as Record<string, unknown>;
}

describe("syncLocale", () => {
  it("fills keys missing from the locale with the English value", () => {
    const en = { a: "A", nested: { x: "X", y: "Y" } };
    const locale = { a: "A-л", nested: { x: "X-л" } };
    expect(syncLocale(en, locale)).toEqual({ a: "A-л", nested: { x: "X-л", y: "Y" } });
  });

  it("keeps the locale's own key order and appends new keys in en order", () => {
    const en = { a: "A", b: "B", c: "C" };
    const locale = { c: "C-л", a: "A-л" };
    expect(Object.keys(syncLocale(en, locale))).toEqual(["c", "a", "b"]);
  });

  it("drops orphan keys that no longer exist in en.json", () => {
    const en = { a: "A" };
    const locale = { a: "A-л", ghost: "gone" };
    expect(syncLocale(en, locale)).toEqual({ a: "A-л" });
  });

  it("replaces empty and MISSING_MESSAGE locale values with English", () => {
    const en = { a: "A", b: "B" };
    const locale = { a: "", b: "MISSING_MESSAGE" };
    expect(syncLocale(en, locale)).toEqual({ a: "A", b: "B" });
  });

  it("falls back to English when a locale namespace is a leaf in en.json", () => {
    const en = { a: "A" };
    const locale = { a: { nested: "x" } };
    expect(syncLocale(en, locale)).toEqual({ a: "A" });
  });

  it("builds a new namespace from English when the locale lacks it", () => {
    const en = { a: "A", deep: { x: "X", y: "Y" } };
    const locale = { a: "A-л" };
    expect(syncLocale(en, locale)).toEqual({ a: "A-л", deep: { x: "X", y: "Y" } });
  });

  it("treats a non-object locale as empty", () => {
    const en = { a: "A", nested: { x: "X" } };
    expect(syncLocale(en, undefined)).toEqual(en);
    expect(syncLocale(en, null as never)).toEqual(en);
  });

  it("keeps translated placeholder values as-is", () => {
    const en = { hello: "Hello {name}" };
    const locale = { hello: "Привет {name}" };
    expect(syncLocale(en, locale)).toEqual({ hello: "Привет {name}" });
  });
});

describe("leafPaths", () => {
  it("flattens nested namespaces into dot-paths", () => {
    expect(leafPaths({ a: "A", b: { c: "C", d: { e: "E" } } })).toEqual(["a", "b.c", "b.d.e"]);
  });
});

describe("syncMessagesDir integration", () => {
  it("reports every committed locale as already in sync with en.json", () => {
    const { changed, fileCount } = syncMessagesDir();
    expect(fileCount).toBeGreaterThan(0);
    expect(changed).toEqual([]);
  });

  it("reports out-of-sync locales from an arbitrary directory", () => {
    const dir = tempMessagesDir({ editor: { undo: "Отменить" } });
    try {
      const { changed, fileCount } = syncMessagesDir(path.join(dir, "messages"));
      expect(fileCount).toBe(1);
      expect(changed).toEqual([{ file: "ru.json", addedKeys: ["editor.grid", "nav.home"] }]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("runCliSync", () => {
  it("reports drift with a non-zero exit code in check mode", () => {
    const dir = tempMessagesDir({ editor: { undo: "Отменить" } });
    try {
      const { errors, exitCode } = runCliSync(path.join(dir, "messages"), true);
      expect(exitCode).toBe(1);
      expect(errors.join("\n")).toContain("out of sync");
      expect(errors.join("\n")).toContain("editor.grid");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("passes check mode when every locale is in sync", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "i18n-sync-"));
    try {
      cpSync(path.join(process.cwd(), "messages"), path.join(dir, "messages"), { recursive: true });
      const { errors, logs, exitCode } = runCliSync(path.join(dir, "messages"), true);
      expect(exitCode).toBe(0);
      expect(errors).toEqual([]);
      expect(logs.join("\n")).toMatch(/in sync/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("backfills missing keys into locale files in write mode", () => {
    const dir = tempMessagesDir({ editor: { undo: "Отменить" } });
    try {
      const { logs, exitCode } = runCliSync(path.join(dir, "messages"), false);
      expect(exitCode).toBe(0);
      expect(logs.join("\n")).toMatch(/updated 1 of 1/);
      expect(readLocale(dir)).toMatchObject({ editor: { undo: "Отменить", grid: "Grid" }, nav: { home: "Home" } });
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prunes orphan keys and reports a restructure in write mode", () => {
    const dir = tempMessagesDir({ editor: { undo: "Отменить", grid: "Сетка", ghost: "gone" }, nav: { home: "Главная" } });
    try {
      const { logs, exitCode } = runCliSync(path.join(dir, "messages"), false);
      expect(exitCode).toBe(0);
      expect(logs.join("\n")).toContain("restructured");
      expect(readLocale(dir).editor).not.toHaveProperty("ghost");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports nothing to do when every locale is already in sync", () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "i18n-sync-"));
    try {
      cpSync(path.join(process.cwd(), "messages"), path.join(dir, "messages"), { recursive: true });
      const { logs, exitCode } = runCliSync(path.join(dir, "messages"), false);
      expect(exitCode).toBe(0);
      expect(logs.join("\n")).toMatch(/nothing to do/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("main CLI entrypoint", () => {
  const originalCwd = process.cwd();
  const originalArgv = process.argv;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  afterEach(() => {
    process.chdir(originalCwd);
    process.argv = originalArgv;
    logSpy?.mockRestore();
    errorSpy?.mockRestore();
    exitSpy?.mockRestore();
  });

  function stubProcess(argv: string[]) {
    process.argv = argv;
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {}) as never);
  }

  it("writes missing keys and logs the update summary", async () => {
    const dir = tempMessagesDir({ editor: { undo: "Отменить" } });
    try {
      stubProcess([process.execPath, SCRIPT_PATH]);
      await main(path.join(dir, "messages"));
      expect(exitSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("updated 1 of 1"));
      expect(readLocale(dir)).toHaveProperty("nav.home");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("exits non-zero on check drift", async () => {
    const dir = tempMessagesDir({ editor: { undo: "Отменить" } });
    try {
      stubProcess([process.execPath, SCRIPT_PATH, "--check"]);
      await main(path.join(dir, "messages"));
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("out of sync"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports success when check finds nothing to fix", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "i18n-sync-"));
    try {
      cpSync(path.join(process.cwd(), "messages"), path.join(dir, "messages"), { recursive: true });
      stubProcess([process.execPath, SCRIPT_PATH, "--check"]);
      await main(path.join(dir, "messages"));
      expect(exitSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("in sync"));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("runs main automatically when executed as the CLI entrypoint", async () => {
    const dir = tempMessagesDir({ editor: { undo: "Отменить" } });
    try {
      process.chdir(dir);
      stubProcess([process.execPath, SCRIPT_PATH, "--check"]);
      vi.resetModules();
      await import("@/scripts/i18n-sync.mjs");
      await vi.waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("out of sync"));
      });
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports a fatal error when the CLI fails at startup", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "i18n-sync-"));
    try {
      process.chdir(dir);
      stubProcess([process.execPath, SCRIPT_PATH, "--check"]);
      vi.resetModules();
      await import("@/scripts/i18n-sync.mjs");
      await vi.waitFor(() => {
        expect(exitSpy).toHaveBeenCalledWith(1);
      });
      expect(errorSpy).toHaveBeenCalledWith(expect.any(Error));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
