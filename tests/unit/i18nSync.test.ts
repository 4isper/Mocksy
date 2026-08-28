import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { locales } from "@/i18n/locales";
import { localeCoverage } from "@/i18n/generated";

// Flattens a nested message object into its dot-notation keys so two locales
// can be compared by structure regardless of their values.
function flattenKeys(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object") return prefix ? [prefix] : [];
  const out: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    out.push(...flattenKeys(child, prefix ? `${prefix}.${key}` : key));
  }
  return out;
}

const messagesDir = path.resolve(process.cwd(), "messages");

describe("i18n message parity", () => {
  const files = fs.readdirSync(messagesDir).filter((f) => f.endsWith(".json"));
  const en = JSON.parse(fs.readFileSync(path.join(messagesDir, "en.json"), "utf8"));
  const enKeys = new Set(flattenKeys(en));

  it("has a message file for every declared locale", () => {
    const missing = locales.filter((l) => !files.includes(`${l}.json`));
    expect(missing, `locales without a message file: ${missing.join(", ")}`).toEqual([]);
  });

  it("keeps every locale structurally in sync with en", () => {
    const drift: string[] = [];
    for (const locale of locales) {
      if (locale === "en") continue;
      const data = JSON.parse(fs.readFileSync(path.join(messagesDir, `${locale}.json`), "utf8"));
      const keys = new Set(flattenKeys(data));
      if (keys.size !== enKeys.size || [...enKeys].some((k) => !keys.has(k))) {
        drift.push(locale);
      }
    }
    expect(drift, `locales out of structural sync with en: ${drift.join(", ")}`).toEqual([]);
  });

  it("keeps en and ru at 100% coverage", () => {
    expect(localeCoverage.en).toBe(100);
    expect(localeCoverage.ru).toBe(100);
  });

  it("reports coverage for every declared locale", () => {
    const missing = locales.filter((l) => typeof localeCoverage[l] !== "number");
    expect(missing, `locales missing from generated coverage: ${missing.join(", ")}`).toEqual([]);
  });
});
