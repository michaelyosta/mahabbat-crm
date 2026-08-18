export const parseActivityTimestamp = (value: unknown): number | null => {
  if (typeof value !== 'string' && !(value instanceof Date)) return null;

  const time =
    value instanceof Date ? value.getTime() : Date.parse(value as string);

  return Number.isFinite(time) ? time : null;
};

// Returns the candidate ISO timestamp only when it is strictly later than the
// current value, otherwise the current value. Activity time is monotonic: it
// never regresses, and invalid input never overwrites a valid value.
export const mergeLastActivityAt = (
  current: string | null | undefined,
  candidate: string | Date,
): string | null => {
  const candidateTime = parseActivityTimestamp(candidate);

  if (candidateTime === null) {
    return current ?? null;
  }

  const currentTime = current == null ? null : parseActivityTimestamp(current);

  if (currentTime !== null && candidateTime <= currentTime) {
    return current ?? null;
  }

  return new Date(candidateTime).toISOString();
};