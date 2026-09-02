import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const messagesDir = path.join(process.cwd(), "messages");
const sourceDirs = ["components", "app", "lib"];

function readMessages(locale: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(messagesDir, `${locale}.json`), "utf-8")) as Record<string, unknown>;
}

function readLocaleFile(filename: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(path.join(messagesDir, filename), "utf-8")) as Record<string, unknown>;
}

/** Collects dot-path keys: `leaves` (string values) and `objects` (namespaces). */
function collectPaths(obj: Record<string, unknown>, prefix = "", leaves: Set<string> = new Set(), objects: Set<string> = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      objects.add(p);
      collectPaths(v as Record<string, unknown>, p, leaves, objects);
    } else {
      leaves.add(p);
    }
  }
  return { leaves, objects };
}

function getByPath(obj: Record<string, unknown>, p: string): unknown {
  return p.split(".").reduce<unknown>((o, s) => (o && typeof o === "object" ? (o as Record<string, unknown>)[s] : undefined), obj);
}

function placeholders(s: string): Set<string> {
  return new Set(s.match(/\{([a-zA-Z0-9_]+)\}/g) ?? []);
}

function listSourceFiles(): string[] {
  const files: string[] = [];
  const walkDir = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walkDir(full);
      else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
    }
  };
  for (const dir of sourceDirs) walkDir(dir);
  return files;
}

const en = readMessages("en");
const { leaves, objects } = collectPaths(en);
const allPaths = new Set([...leaves, ...objects]);
const localeFiles = fs
  .readdirSync(messagesDir)
  .filter((f) => f.endsWith(".json") && f !== "en.json")
  .sort();

describe("translation keys used in the codebase resolve in en.json", () => {
  it("every static t(\"...\") call points at an existing message", () => {
    const missing: string[] = [];
    for (const file of listSourceFiles()) {
      const src = fs.readFileSync(file, "utf-8");
      const ns = src.match(/useTranslations\(\s*"([^"]+)"\s*\)/)?.[1] ?? null;
      for (const m of src.matchAll(/\bt\(\s*"([^"]+)"\s*\)/g)) {
        const raw = m[1]!;
        const key = !raw.includes(".") && ns ? `${ns}.${raw}` : raw;
        if (!leaves.has(key)) {
          missing.push(`${file}: t("${raw}") resolves to "${key}", which is not a message in en.json`);
        }
      }
    }
    expect(missing, missing.join("\n")).toEqual([]);
  });

  it("dynamic template-literal t(\`...\`) calls start at an existing namespace", () => {
    const bad: string[] = [];
    for (const file of listSourceFiles()) {
      const src = fs.readFileSync(file, "utf-8");
      const ns = src.match(/useTranslations\(\s*"([^"]+)"\s*\)/)?.[1] ?? null;
      for (const m of src.matchAll(/\bt\(\s*`([^`$]*)/g)) {
        const prefix = m[1]!;
        const key = !prefix.includes(".") && ns ? `${ns}.${prefix}` : prefix;
        const namespace = key.replace(/\.$/, "");
        // The prefix may be a real namespace object (e.g. "export.") or a key
        // prefix of leaves (e.g. "annotation.align" + "Left" = "alignLeft").
        const resolves = namespace.length > 0 && (objects.has(namespace) || [...leaves].some((p) => p.startsWith(namespace)));
        if (!resolves) {
          bad.push(`${file}: t(\`${prefix}...\`) builds keys under "${namespace}", which is not a namespace in en.json`);
        }
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("static t(\"...\") calls pass every placeholder the message needs", () => {
    const bad: string[] = [];
    const placeholdersOf = (s: string) => [...s.matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]);
    for (const file of listSourceFiles()) {
      const src = fs.readFileSync(file, "utf-8");
      const ns = src.match(/useTranslations\(\s*"([^"]+)"\s*\)/)?.[1] ?? null;
      for (const m of src.matchAll(/\bt\(\s*"([^"]+)"\s*\)/g)) {
        const raw = m[1]!;
        const key = !raw.includes(".") && ns ? `${ns}.${raw}` : raw;
        const value = getByPath(en, key);
        if (typeof value === "string" && placeholdersOf(value).length > 0) {
          bad.push(`${file}: t("${raw}") for "${key}" doesn't pass ${placeholdersOf(value).map((p) => `{${p}}`).join(", ")}`);
        }
      }
      for (const m of src.matchAll(/\bt\(\s*"([^"]+)"\s*,\s*\{([^}]*)\}\)/g)) {
        const raw = m[1]!;
        const body = m[2]!;
        const key = !raw.includes(".") && ns ? `${ns}.${raw}` : raw;
        const value = getByPath(en, key);
        if (typeof value !== "string") continue;
        for (const p of placeholdersOf(value)) {
          if (!new RegExp(`\\b${p}\\b`).test(body)) {
            bad.push(`${file}: t("${raw}") for "${key}" is missing {${p}}`);
          }
        }
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
});

describe("en.json is the complete message tree", () => {
  it("has only non-empty string values", () => {
    const bad: string[] = [];
    const check = (obj: Record<string, unknown>, prefix = "") => {
      for (const [k, v] of Object.entries(obj)) {
        const p = prefix ? `${prefix}.${k}` : k;
        if (v !== null && typeof v === "object" && !Array.isArray(v)) {
          check(v as Record<string, unknown>, p);
        } else if (typeof v !== "string") {
          bad.push(`${p}: expected a string, got ${typeof v}`);
        } else if (!v.trim()) {
          bad.push(`${p}: empty string`);
        } else if (v === "MISSING_MESSAGE") {
          bad.push(`${p}: MISSING_MESSAGE marker leaked into the base tree`);
        }
      }
    };
    check(en);
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("sectionKeywords covers every control-panel section and carries real aliases", () => {
    const sectionIds = ["media", "text", "frame", "arrange", "animation", "position", "filters", "background", "watermark", "screen"];
    const keywords = getByPath(en, "editor.sectionKeywords") as Record<string, string>;
    expect(Object.keys(keywords).sort()).toEqual([...sectionIds].sort());
    // Representative alias words per section (English + the Russian tree).
    const aliases: [string, string][] = [
      ["media", "upload"],
      ["text", "font"],
      ["frame", "material"],
      ["arrange", "align"],
      ["animation", "easing"],
      ["position", "shadow"],
      ["filters", "blur"],
      ["background", "gradient"],
      ["watermark", "watermark"],
      ["screen", "app grid, folder, widget, dock icons, notification, glare"]
    ];
    const ruKeywords = getByPath(readMessages("ru"), "editor.sectionKeywords") as Record<string, string>;
    for (const [id, word] of aliases) {
      for (const w of word.split(",").map((s) => s.trim()).filter(Boolean)) {
        expect(keywords[id]!.toLowerCase(), `en alias "${w}" missing from sectionKeywords.${id}`).toContain(w);
      }
      expect(ruKeywords[id]!.length).toBeGreaterThan(0);
    }
  });
});

describe("locale files stay consistent with en.json", () => {
  it("locale keys are a strict subset of en.json keys (no orphans)", () => {
    const orphans: string[] = [];
    for (const file of localeFiles) {
      const { leaves: locLeaves, objects: locObjects } = collectPaths(readLocaleFile(file));
      for (const p of [...locLeaves, ...locObjects]) {
        if (!allPaths.has(p)) orphans.push(`${file}: "${p}"`);
      }
    }
    expect(orphans, orphans.join("\n")).toEqual([]);
  });

  it("locale values keep the same structure (namespace vs leaf) as en.json", () => {
    const bad: string[] = [];
    for (const file of localeFiles) {
      const { leaves: locLeaves, objects: locObjects } = collectPaths(readLocaleFile(file));
      for (const p of locLeaves) {
        if (!leaves.has(p)) bad.push(`${file}: "${p}" is a leaf but a namespace in en.json`);
      }
      for (const p of locObjects) {
        if (!objects.has(p)) bad.push(`${file}: "${p}" is a namespace but a leaf in en.json`);
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("locale placeholders ({name}) are a subset of the English ones", () => {
    const bad: string[] = [];
    for (const file of localeFiles) {
      const loc = readLocaleFile(file);
      const { leaves: locLeaves } = collectPaths(loc);
      for (const p of locLeaves) {
        const enValue = getByPath(en, p);
        const locValue = getByPath(loc, p);
        if (typeof enValue !== "string" || typeof locValue !== "string") continue;
        const enTokens = placeholders(enValue);
        for (const token of placeholders(locValue)) {
          if (!enTokens.has(token)) {
            bad.push(`${file}: "${p}" uses ${token} which is not in en.json's "${enValue}"`);
          }
        }
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });

  it("every locale translates every en.json key (full parity)", () => {
    const bad: string[] = [];
    for (const file of localeFiles) {
      const loc = readLocaleFile(file);
      const { leaves: locLeaves } = collectPaths(loc);
      for (const p of [...leaves].filter((p) => !locLeaves.has(p))) {
        bad.push(`${file}: missing "${p}"`);
      }
      for (const p of [...locLeaves].filter((p) => !leaves.has(p))) {
        bad.push(`${file}: extra "${p}"`);
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
});
