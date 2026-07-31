type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

/** Deep-merges `override` onto `base`, keeping `base` values for any key
 *  the locale file does not provide. Used so a partial translation can fall
 *  back to English instead of rendering `MISSING_MESSAGE`. */
export function deepMerge(base: JsonValue, override: JsonValue): JsonValue {
  if (isPlainRecord(base) && isPlainRecord(override)) {
    const out: Record<string, JsonValue> = {};
    for (const key of Object.keys(base)) {
      const baseValue = base[key] as JsonValue;
      out[key] = Object.prototype.hasOwnProperty.call(override, key)
        ? deepMerge(baseValue, (override as Record<string, JsonValue>)[key] as JsonValue)
        : baseValue;
    }
    return out;
  }
  return override;
}

function isPlainRecord(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
