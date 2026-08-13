/**
 * Parse a value that may arrive as an already-parsed object (json/jsonb
 * columns are deserialized by the Neon driver) or as a JSON string.
 * Never throws on object/array input (JSON.parse would produce
 * `SyntaxError: "[object Object]" is not valid JSON`).
 */
export function safeParseJSON<T = any>(value: unknown): T {
  return typeof value === 'string' ? JSON.parse(value) as T : value as T;
}
