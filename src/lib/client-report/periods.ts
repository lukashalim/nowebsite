export const REPORT_TIME_ZONE = "America/New_York";

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const value: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") value[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(
    value.year,
    (value.month ?? 1) - 1,
    value.day,
    value.hour,
    value.minute,
    value.second,
  );
  return asUtc - date.getTime();
}

/** Instant for YYYY-MM-DD 00:00:00 in `timeZone`. */
export function zonedMidnightUtc(
  year: number,
  month: number,
  day: number,
  timeZone: string,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0);
  const offset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  let utc = utcGuess - offset;
  const offset2 = getTimeZoneOffsetMs(new Date(utc), timeZone);
  if (offset2 !== offset) {
    utc -= offset2 - offset;
  }
  return new Date(utc);
}

export function reportPeriodStarts(
  now = new Date(),
  timeZone = REPORT_TIME_ZONE,
): { yearStart: Date; monthStart: Date } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return {
    yearStart: zonedMidnightUtc(year, 1, 1, timeZone),
    monthStart: zonedMidnightUtc(year, month, 1, timeZone),
  };
}

export function formatReportMonthLabel(
  now = new Date(),
  timeZone = REPORT_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "long",
    year: "numeric",
  }).format(now);
}

export function formatReportYearLabel(
  now = new Date(),
  timeZone = REPORT_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
  }).format(now);
}
