export const parseActivityTimestamp = (value: unknown): number | null => {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;

  const time =
    value instanceof Date ? value.getTime() : Date.parse(value as string);

  return Number.isFinite(time) ? time : null;
};

// Returns a valid ISO-8601 timestamp for a candidate, or null when the input
// cannot be interpreted as a timestamp. Invalid input never reaches the store.
export const normalizeActivityTimestamp = (
  value: string | Date | null | undefined,
): string | null => {
  const time = value == null ? null : parseActivityTimestamp(value);

  return time === null ? null : new Date(time).toISOString();
};