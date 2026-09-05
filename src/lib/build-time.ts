const UTC_PLUS_8_OFFSET_MS = 8 * 60 * 60 * 1000;

const pad = (value: number): string => String(value).padStart(2, '0');

function parseBuildTimeAsUtc(value: string): number | null {
  const trimmed = value.trim();
  const legacy = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:\s*UTC|Z)?$/i,
  );

  if (legacy) {
    const [, year, month, day, hour, minute, second] = legacy;
    const timestamp = Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    );
    const parsed = new Date(timestamp);
    const valid = parsed.getUTCFullYear() === Number(year)
      && parsed.getUTCMonth() === Number(month) - 1
      && parsed.getUTCDate() === Number(day)
      && parsed.getUTCHours() === Number(hour)
      && parsed.getUTCMinutes() === Number(minute)
      && parsed.getUTCSeconds() === Number(second);
    return valid ? timestamp : null;
  }

  // Future server versions may return an ISO timestamp with an explicit zone.
  // Do not let Date.parse interpret another unzoned format in the user's locale.
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed)) return null;
  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp) ? timestamp : null;
}

/** Format the server's UTC build timestamp in the product's fixed UTC+8 zone. */
export function formatBuildTimeUtc8(value: string): string {
  const timestamp = parseBuildTimeAsUtc(value);
  if (timestamp === null) return value;

  const date = new Date(timestamp + UTC_PLUS_8_OFFSET_MS);
  return [
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`,
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`,
  ].join(' ');
}
