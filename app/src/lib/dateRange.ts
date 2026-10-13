export type DateRangePreset =
  | "7d"
  | "this-month"
  | "last-month"
  | "this-year"
  | "last-year"
  | "custom";

export interface DateRange {
  preset: DateRangePreset;
  /** Inclusive, start of day. */
  start: Date;
  /** Inclusive, end of day. */
  end: Date;
}

const DUTCH_MONTHS_SHORT = [
  "jan",
  "feb",
  "mrt",
  "apr",
  "mei",
  "jun",
  "jul",
  "aug",
  "sep",
  "okt",
  "nov",
  "dec",
];

const DUTCH_MONTHS_FULL = [
  "Januari",
  "Februari",
  "Maart",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Augustus",
  "September",
  "Oktober",
  "November",
  "December",
];

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function endOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

function startOfMonth(d: Date): Date {
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
}

function endOfMonth(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function startOfYear(d: Date): Date {
  return startOfDay(new Date(d.getFullYear(), 0, 1));
}

function endOfYear(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), 11, 31));
}

/** Builds the {start, end} window for a preset, anchored on `now`. For
 * "custom", `customStart`/`customEnd` are required — the caller (the date
 * picker) is responsible for collecting them first. */
export function rangeForPreset(
  preset: DateRangePreset,
  now: Date = new Date(),
  customStart?: Date,
  customEnd?: Date,
): DateRange {
  switch (preset) {
    case "7d": {
      const start = startOfDay(new Date(now));
      start.setDate(start.getDate() - 6);
      return { preset, start, end: endOfDay(now) };
    }
    case "this-month":
      return { preset, start: startOfMonth(now), end: endOfMonth(now) };
    case "last-month": {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return { preset, start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
    case "this-year":
      return { preset, start: startOfYear(now), end: endOfYear(now) };
    case "last-year": {
      const lastYear = new Date(now.getFullYear() - 1, 0, 1);
      return { preset, start: startOfYear(lastYear), end: endOfYear(lastYear) };
    }
    case "custom":
      return {
        preset,
        start: startOfDay(customStart ?? now),
        end: endOfDay(customEnd ?? now),
      };
  }
}

/** The immediately preceding period of the same kind/length — the
 * baseline every "vs vorige periode" delta is measured against. */
export function previousRange(range: DateRange): DateRange {
  switch (range.preset) {
    case "this-month": {
      const prevMonth = new Date(range.start.getFullYear(), range.start.getMonth() - 1, 1);
      return { preset: "this-month", start: startOfMonth(prevMonth), end: endOfMonth(prevMonth) };
    }
    case "last-month": {
      const prevMonth = new Date(range.start.getFullYear(), range.start.getMonth() - 1, 1);
      return { preset: "last-month", start: startOfMonth(prevMonth), end: endOfMonth(prevMonth) };
    }
    case "this-year": {
      const prevYear = new Date(range.start.getFullYear() - 1, 0, 1);
      return { preset: "this-year", start: startOfYear(prevYear), end: endOfYear(prevYear) };
    }
    case "last-year": {
      const prevYear = new Date(range.start.getFullYear() - 1, 0, 1);
      return { preset: "last-year", start: startOfYear(prevYear), end: endOfYear(prevYear) };
    }
    case "7d":
    case "custom": {
      const lengthMs = range.end.getTime() - range.start.getTime();
      const prevEnd = new Date(range.start.getTime() - 1);
      const prevStart = new Date(prevEnd.getTime() - lengthMs);
      return { preset: range.preset, start: startOfDay(prevStart), end: endOfDay(prevEnd) };
    }
  }
}

/** Whether a given moment falls inside the range, inclusive both ends. */
export function isWithinRange(date: Date, range: DateRange): boolean {
  return date.getTime() >= range.start.getTime() && date.getTime() <= range.end.getTime();
}

/** Human label for the current selection, e.g. "6 - 13 okt", "Oktober
 * 2026", "2026", or "3 jan - 14 feb 2026" for a custom range. */
export function formatRangeLabel(range: DateRange): string {
  const { start, end } = range;

  if (range.preset === "this-month" || range.preset === "last-month") {
    return `${DUTCH_MONTHS_FULL[start.getMonth()]} ${start.getFullYear()}`;
  }
  if (range.preset === "this-year" || range.preset === "last-year") {
    return `${start.getFullYear()}`;
  }

  const startMonth = DUTCH_MONTHS_SHORT[start.getMonth()];
  const endMonth = DUTCH_MONTHS_SHORT[end.getMonth()];
  const sameYear = start.getFullYear() === end.getFullYear();
  // Only a custom range needs the year spelled out — the preset ranges
  // are never ambiguous about which year they mean.
  const yearSuffix = range.preset === "custom" ? ` ${end.getFullYear()}` : "";

  if (startMonth === endMonth && sameYear) {
    return `${start.getDate()} - ${end.getDate()} ${endMonth}${yearSuffix}`;
  }
  if (sameYear) {
    return `${start.getDate()} ${startMonth} - ${end.getDate()} ${endMonth}${yearSuffix}`;
  }
  return `${start.getDate()} ${startMonth} ${start.getFullYear()} - ${end.getDate()} ${endMonth} ${end.getFullYear()}`;
}

export const PRESET_LABELS: Record<Exclude<DateRangePreset, "custom">, string> = {
  "7d": "Laatste 7 dagen",
  "this-month": "Deze maand",
  "last-month": "Vorige maand",
  "this-year": "Dit jaar",
  "last-year": "Vorig jaar",
};
