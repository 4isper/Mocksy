declare module "@/scripts/i18n-sync.mjs" {
  export type JsonRecord = Record<string, unknown>;
  export function syncLocale(en: JsonRecord, locale: unknown): JsonRecord;
  export function leafPaths(obj: JsonRecord, prefix?: string): string[];
  export function syncMessagesDir(
    dir?: string
  ): { changed: { file: string; addedKeys: string[] }[]; fileCount: number };
}
