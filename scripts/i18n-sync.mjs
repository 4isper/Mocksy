#!/usr/bin/env node
/**
 * Syncs every messages/<locale>.json with en.json (the source of truth).
 *
 * en.json is the canonical message tree; other locales lag behind whenever a
 * new key is added. This script deep-merges en.json into each locale so that:
 *
 *   - every en.json key exists in every locale (missing keys fall back to the
 *     English value, mirroring the runtime deepMerge fallback),
 *   - orphan keys that no longer exist in en.json are pruned,
 *   - the locale's own key order and translations are preserved (only new keys
 *     are appended within their namespace), keeping the diff minimal.
 *
 * It also computes each locale's translation coverage and writes the derived
 * status to i18n/generated.ts (consumed by the LocaleSwitcher to flag partial
 * locales). A leaf counts as untranslated when its value equals the English
 * value but the hand-translated reference locale (ru.json) translated it —
 * brands and formats ("PNG", "Google") that are intentionally identical across
 * languages are not counted as missing.
 *
 * Usage:
 *   npm run i18n:sync          # write updated locale files + i18n/generated.ts
 *   npm run i18n:sync -- --check  # exit 1 if any locale is out of sync (CI)
 *   npm run i18n:report        # untranslated key counts per locale
 *   npm run i18n:report -- --keys  # also list the untranslated dot-paths
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MESSAGES_DIR = path.join(process.cwd(), "messages");
const REFERENCE_LOCALE = "ru";

const isPlainRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** A locale value counts as translated only when it is a non-empty string that
 *  is not next-intl's "MISSING_MESSAGE" marker; anything else falls back to the
 *  English value. */
function translatedLeaf(value) {
  return typeof value === "string" && value.trim() !== "" && value !== "MISSING_MESSAGE" ? value : null;
}

/** Resolves a dot-path like "editor.grid" to the leaf value (undefined if any
 *  segment is missing). */
function getLeaf(obj, dotPath) {
  return dotPath.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

/** Leaves whose English value is intentionally identical across languages
 *  (brands, formats, proper nouns). Derived from the hand-translated reference
 *  locale: a leaf is a "shared term" when ru keeps the English value. */
function sharedTermPaths(en, ru) {
  const shared = new Set();
  for (const p of leafPaths(en)) {
    if (getLeaf(ru, p) === getLeaf(en, p)) shared.add(p);
  }
  return shared;
}

/** Deep-merges `en` onto `locale`, preserving the locale's own key order and
 *  translations. Keys present only in `en` are appended (in en order) so the
 *  output is deterministic; keys absent from `en` are dropped. */
export function syncLocale(en, locale) {
  const out = {};
  const src = isPlainRecord(locale) ? locale : {};
  for (const key of Object.keys(src)) {
    if (!hasOwn(en, key)) continue;
    const enValue = en[key];
    const locValue = src[key];
    out[key] = isPlainRecord(enValue) ? syncLocale(enValue, locValue) : translatedLeaf(locValue) ?? enValue;
  }
  for (const key of Object.keys(en)) {
    if (hasOwn(out, key)) continue;
    const enValue = en[key];
    out[key] = isPlainRecord(enValue) ? syncLocale(enValue, undefined) : enValue;
  }
  return out;
}

/** Flat dot-path list of every leaf in a message tree. */
export function leafPaths(obj, prefix = "") {
  const out = [];
  for (const [key, value] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${key}` : key;
    if (isPlainRecord(value)) out.push(...leafPaths(value, p));
    else out.push(p);
  }
  return out;
}

/** Reads every locale in `dir`, computes the synced content and reports which
 *  files would change. Never writes — callers decide. */
export function syncMessagesDir(dir = MESSAGES_DIR) {
  const en = JSON.parse(readFileSync(path.join(dir, "en.json"), "utf-8"));
  const enLeaves = new Set(leafPaths(en));
  const changed = [];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "en.json")
    .sort();
  for (const file of files) {
    const full = path.join(dir, file);
    const original = JSON.parse(readFileSync(full, "utf-8"));
    const synced = syncLocale(en, original);
    const serialized = `${JSON.stringify(synced, null, 2)}\n`;
    const current = readFileSync(full, "utf-8");
    if (serialized !== current) {
      const originalLeaves = new Set(leafPaths(original));
      const addedKeys = [...enLeaves].filter((p) => !originalLeaves.has(p));
      changed.push({ file, addedKeys });
    }
  }
  return { changed, fileCount: files.length };
}

/** Percentage of en.json leaves genuinely translated in each locale, keyed by
 *  locale code. en is always 100. A leaf counts as an untranslated fallback
 *  when its value equals the English value but the reference locale translated
 *  it (i.e. it is not a shared term). */
export function computeCoverage(dir = MESSAGES_DIR) {
  const en = JSON.parse(readFileSync(path.join(dir, "en.json"), "utf-8"));
  const ru = JSON.parse(readFileSync(path.join(dir, `${REFERENCE_LOCALE}.json`), "utf-8"));
  const shared = sharedTermPaths(en, ru);
  const enLeaves = leafPaths(en);
  const total = enLeaves.length;
  const coverage = { en: 100 };
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "en.json")
    .sort();
  for (const file of files) {
    const locale = file.replace(/\.json$/, "");
    const loc = JSON.parse(readFileSync(path.join(dir, file), "utf-8"));
    const backfills = enLeaves.filter((p) => getLeaf(loc, p) === getLeaf(en, p) && !shared.has(p)).length;
    coverage[locale] = Math.round(((total - backfills) / total) * 100);
  }
  return coverage;
}

/** Per-locale list of untranslated leaves: values that still equal English
 *  while the reference locale translated them (shared terms excluded), sorted
 *  by missing count. Powers `npm run i18n:report -- --keys` so translation
 *  passes and contributors get an actionable backlog instead of a bare
 *  percentage. */
export function missingTranslations(dir = MESSAGES_DIR, { keys = false } = {}) {
  const en = JSON.parse(readFileSync(path.join(dir, "en.json"), "utf-8"));
  const ru = JSON.parse(readFileSync(path.join(dir, `${REFERENCE_LOCALE}.json`), "utf-8"));
  const shared = sharedTermPaths(en, ru);
  const enLeaves = leafPaths(en);
  const rows = [];
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "en.json" && f !== `${REFERENCE_LOCALE}.json`)
    .sort();
  for (const file of files) {
    const locale = file.replace(/\.json$/, "");
    const loc = JSON.parse(readFileSync(path.join(dir, file), "utf-8"));
    const missing = enLeaves.filter((p) => getLeaf(loc, p) === getLeaf(en, p) && !shared.has(p));
    rows.push({ locale, count: missing.length, ...(keys ? { keys: missing } : {}) });
  }
  return rows.sort((a, b) => b.count - a.count || a.locale.localeCompare(b.locale));
}

/** Serializes the coverage map into the generated TS module consumed by the
 *  LocaleSwitcher. Kept dependency-free so the output is deterministic. */
export function renderCoverageModule(coverage) {
  const entries = Object.entries(coverage)
    .map(([locale, percent]) => `  ${JSON.stringify(locale)}: ${percent}`)
    .join(",\n");
  return (
    "// AUTO-GENERATED by scripts/i18n-sync.mjs — do not edit manually.\n" +
    "// Translation coverage per locale (100 = fully translated).\n" +
    "export const localeCoverage: Record<string, number> = {\n" +
    `${entries}\n` +
    "};\n"
  );
}

/** The generated module path derived from the messages directory so temp-dir
 *  test runs stay isolated from the repo. */
function generatedFilePath(dir) {
  return path.join(path.dirname(dir), "i18n", "generated.ts");
}

function readGeneratedFile(dir) {
  try {
    return readFileSync(generatedFilePath(dir), "utf-8");
  } catch {
    return null;
  }
}

function writeGeneratedFile(dir) {
  const target = generatedFilePath(dir);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, renderCoverageModule(computeCoverage(dir)));
}

/** Runs the sync without touching the process: in `checkMode` it only reports
 *  drift (exitCode 1 when any locale or the generated status module is out of
 *  sync); otherwise it rewrites out-of-sync locales and the generated module,
 *  and reports what changed. */
export function runCliSync(dir = MESSAGES_DIR, checkMode = false) {
  const { changed, fileCount } = syncMessagesDir(dir);
  const errors = [];
  const logs = [];

  if (checkMode) {
    for (const { file, addedKeys } of changed) {
      const detail = addedKeys.length > 0 ? ` missing ${addedKeys.length} key(s): ${addedKeys.join(", ")}` : " differs from a sync run";
      errors.push(`i18n-sync: ${file}${detail}`);
    }
    const generatedOutdated = readGeneratedFile(dir) !== renderCoverageModule(computeCoverage(dir));
    if (generatedOutdated) {
      errors.push("i18n-sync: i18n/generated.ts is out of date");
    }
    if (changed.length > 0 || generatedOutdated) {
      const parts = [];
      if (changed.length > 0) parts.push(`${changed.length} of ${fileCount} locale(s) out of sync`);
      if (generatedOutdated) parts.push("i18n/generated.ts out of date");
      errors.push(`i18n-sync FAIL: ${parts.join("; ")} — run \`npm run i18n:sync\`.`);
      return { errors, logs, exitCode: 1 };
    }
    logs.push(`i18n-sync ok: ${fileCount} locale(s) in sync with en.json.`);
    return { errors, logs, exitCode: 0 };
  }

  const en = JSON.parse(readFileSync(path.join(dir, "en.json"), "utf-8"));
  let updated = 0;
  for (const { file, addedKeys } of changed) {
    const full = path.join(dir, file);
    const original = JSON.parse(readFileSync(full, "utf-8"));
    writeFileSync(full, `${JSON.stringify(syncLocale(en, original), null, 2)}\n`);
    logs.push(`i18n-sync: ${file}${addedKeys.length > 0 ? ` added ${addedKeys.length} key(s)` : " restructured"}`);
    updated += 1;
  }
  writeGeneratedFile(dir);
  if (updated === 0) {
    logs.push(`i18n-sync: ${fileCount} locale(s) already in sync, nothing to do.`);
  } else {
    logs.push(`i18n-sync: updated ${updated} of ${fileCount} locale(s).`);
  }
  return { errors, logs, exitCode: 0 };
}

/** CLI entrypoint: prints results and exits non-zero on check drift.
 *  `--report` lists untranslated key counts per locale (with `--keys`, the
 *  actual dot-paths) and never touches files. */
export async function main(dir = MESSAGES_DIR) {
  if (process.argv.includes("--report")) {
    const withKeys = process.argv.includes("--keys");
    for (const row of missingTranslations(dir, { keys: withKeys })) {
      console.log(`${row.locale}: ${row.count} untranslated`);
      if (withKeys) for (const key of row.keys ?? []) console.log(`  ${key}`);
    }
    return;
  }
  const checkMode = process.argv.includes("--check");
  const { errors, logs, exitCode } = runCliSync(dir, checkMode);
  for (const text of errors) console.error(text);
  for (const text of logs) console.log(text);
  if (exitCode !== 0) process.exit(exitCode);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
