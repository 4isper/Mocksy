declare module "@/scripts/i18n-sync.mjs" {
  export type JsonRecord = Record<string, unknown>;
  export function syncLocale(en: JsonRecord, locale: unknown): JsonRecord;
  export function leafPaths(obj: JsonRecord, prefix?: string): string[];
  export function syncMessagesDir(
    dir?: string
  ): { changed: { file: string; addedKeys: string[] }[]; fileCount: number };
  export function computeCoverage(dir?: string): Record<string, number>;
  export function missingTranslations(
    dir?: string,
    opts?: { keys?: boolean }
  ): Array<{ locale: string; count: number; keys?: string[] }>;
  export function renderCoverageModule(coverage: Record<string, number>): string;
  export function runCliSync(
    dir?: string,
    checkMode?: boolean
  ): { errors: string[]; logs: string[]; exitCode: number };
  export function main(dir?: string): Promise<void>;
}
