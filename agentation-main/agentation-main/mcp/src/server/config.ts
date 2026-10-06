// Reject partial parses, negative counts and values that overflow Node timers.
export function integerEnv(
  name: string,
  fallback: number,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
): number {
  const raw = process.env[name]?.trim();
  if (!raw || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value >= min && value <= max
    ? value
    : fallback;
}

export const MAX_TIMER_MS = 2_147_483_647;
