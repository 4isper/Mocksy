import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  computeCoverage,
  leafPaths,
  main,
  renderCoverageModule,
  runCliSync,
  syncLocale,
  syncMessagesDir
} from "@/scripts/i18n-sync.mjs";

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

/** Copies the committed messages and the generated status module so check-mode
 *  tests run against a fully consistent fixture. */
function copyRepoI18n(dir: string) {
  cpSync(path.join(process.cwd(), "messages"), path.join(dir, "messages"), { recursive: true });
  mkdirSync(path.join(dir, "i18n"), { recursive: true });
  cpSync(path.join(process.cwd(), "i18n", "generated.ts"), path.join(dir, "i18n", "generated.ts"));
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

describe("computeCoverage", () => {
  function coverageDir(en: Record<string, unknown>, ru: Record<string, unknown>, locales: Record<string, Record<string, unknown>>): string {
    const dir = mkdtempSync(path.join(os.tmpdir(), "i18n-cov-"));
    const messages = path.join(dir, "messages");
    mkdirSync(messages);
    writeFileSync(path.join(messages, "en.json"), `${JSON.stringify(en, null, 2)}\n`);
    writeFileSync(path.join(messages, "ru.json"), `${JSON.stringify(ru, null, 2)}\n`);
    for (const [locale, msgs] of Object.entries(locales)) {
      writeFileSync(path.join(messages, `${locale}.json`), `${JSON.stringify(msgs, null, 2)}\n`);
    }
    return messages;
  }

  it("reports 100 for en and a fully translated locale", () => {
    const messages = coverageDir(
      { a: "A", b: "B" },
      { a: "А", b: "Б" },
      {}
    );
    try {
      expect(computeCoverage(messages)).toEqual({ en: 100, ru: 100 });
    } finally {
      rmSync(path.dirname(messages), { recursive: true, force: true });
    }
  });

  it("counts English fallbacks as untranslated", () => {
    const messages = coverageDir(
      { a: "A", b: "B", c: "C" },
      { a: "А", b: "Б", c: "В" },
      { de: { a: "A", b: "B", c: "Ц" } }
    );
    try {
      expect(computeCoverage(messages)).toEqual({ en: 100, ru: 100, de: 33 });
    } finally {
      rmSync(path.dirname(messages), { recursive: true, force: true });
    }
  });

  it("does not count leaves identical in the reference locale (shared terms)", () => {
    const messages = coverageDir(
      { a: "A", format: "PNG" },
      { a: "А", format: "PNG" },
      { de: { a: "A", format: "PNG" } }
    );
    try {
      expect(computeCoverage(messages)).toEqual({ en: 100, ru: 100, de: 50 });
    } finally {
      rmSync(path.dirname(messages), { recursive: true, force: true });
    }
  });

  it("reports coverage for every committed locale", () => {
    const coverage = computeCoverage();
    expect(coverage.en).toBe(100);
    expect(coverage.ru).toBe(100);
    expect(Object.keys(coverage).length).toBeGreaterThan(50);
    expect(Object.values(coverage).every((v) => v >= 0 && v <= 100)).toBe(true);
  });
});

describe("renderCoverageModule", () => {
  it("serializes the coverage map into a stable TS module", () => {
    expect(renderCoverageModule({ en: 100, ru: 80 })).toBe(
      "// AUTO-GENERATED by scripts/i18n-sync.mjs — do not edit manually.\n" +
        "// Translation coverage per locale (100 = fully translated).\n" +
        "export const localeCoverage: Record<string, number> = {\n" +
        '  "en": 100,\n' +
        '  "ru": 80\n' +
        "};\n"
    );
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
      copyRepoI18n(dir);
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

  it("writes i18n/generated.ts alongside the messages in write mode", () => {
    const dir = tempMessagesDir({ editor: { undo: "Отменить", grid: "Сетка" }, nav: { home: "Главная" } });
    try {
      const messagesDir = path.join(dir, "messages");
      runCliSync(messagesDir, false);
      const expected = renderCoverageModule(computeCoverage(messagesDir));
      expect(readFileSync(path.join(dir, "i18n", "generated.ts"), "utf-8")).toBe(expected);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fails check mode when i18n/generated.ts is stale", () => {
    const dir = tempMessagesDir({ editor: { undo: "Отменить", grid: "Сетка" }, nav: { home: "Главная" } });
    try {
      mkdirSync(path.join(dir, "i18n"), { recursive: true });
      writeFileSync(path.join(dir, "i18n", "generated.ts"), renderCoverageModule({ en: 100, ru: 0 }));
      const { errors, exitCode } = runCliSync(path.join(dir, "messages"), true);
      expect(exitCode).toBe(1);
      expect(errors.join("\n")).toContain("out of date");
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
      copyRepoI18n(dir);
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
