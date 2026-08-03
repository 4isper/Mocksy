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
 * Usage:
 *   npm run i18n:sync          # write updated locale files
 *   npm run i18n:sync -- --check  # exit 1 if any locale is out of sync (CI)
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MESSAGES_DIR = path.join(process.cwd(), "messages");

const isPlainRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

/** A locale value counts as translated only when it is a non-empty string that
 *  is not next-intl's "MISSING_MESSAGE" marker; anything else falls back to the
 *  English value. */
function translatedLeaf(value) {
  return typeof value === "string" && value.trim() !== "" && value !== "MISSING_MESSAGE" ? value : null;
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

/** Runs the sync without touching the process: in `checkMode` it only reports
 *  drift (exitCode 1 when any locale is out of sync); otherwise it rewrites
 *  out-of-sync locales and reports what changed. */
export function runCliSync(dir = MESSAGES_DIR, checkMode = false) {
  const { changed, fileCount } = syncMessagesDir(dir);
  const errors = [];
  const logs = [];

  if (checkMode) {
    for (const { file, addedKeys } of changed) {
      const detail = addedKeys.length > 0 ? ` missing ${addedKeys.length} key(s): ${addedKeys.join(", ")}` : " differs from a sync run";
      errors.push(`i18n-sync: ${file}${detail}`);
    }
    if (changed.length > 0) {
      errors.push(`i18n-sync FAIL: ${changed.length} of ${fileCount} locale(s) out of sync — run \`npm run i18n:sync\`.`);
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
  if (updated === 0) {
    logs.push(`i18n-sync: ${fileCount} locale(s) already in sync, nothing to do.`);
  } else {
    logs.push(`i18n-sync: updated ${updated} of ${fileCount} locale(s).`);
  }
  return { errors, logs, exitCode: 0 };
}

/** CLI entrypoint: prints results and exits non-zero on check drift. */
export async function main(dir = MESSAGES_DIR) {
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
