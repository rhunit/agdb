export function formatDutchInt(n: number): string {
  return new Intl.NumberFormat("nl-NL").format(Math.round(n));
}

export function formatDutchDecimal(n: number, digits = 1): string {
  return n.toFixed(digits).replace(".", ",");
}

export function formatSignedDecimal(n: number, digits = 1): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "±";
  return `${sign}${formatDutchDecimal(Math.abs(n), digits)}`;
}

export function formatSignedPercent(n: number, digits = 1): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "±";
  return `${sign}${formatDutchDecimal(Math.abs(n), digits)}%`;
}

export function daysAgoLabel(days: number): string {
  if (days <= 0) return "vandaag";
  if (days === 1) return "1 dag geleden";
  return `${days} dagen geleden`;
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

export function formatUpdatedAt(date: Date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${dd}-${mm}-${yyyy} · ${hh}:${min}`;
}

/** Explicit calendar range for "the last N days", e.g. "3 - 10 okt" (or
 * "28 sep - 4 okt" when the range crosses a month) — replaces a vague
 * "laatste N dagen" label with the actual dates it covers. */
export function formatDateRangeLabel(daysBack = 7, end = new Date()): string {
  const start = new Date(end);
  start.setDate(start.getDate() - daysBack);

  const startMonth = DUTCH_MONTHS_SHORT[start.getMonth()];
  const endMonth = DUTCH_MONTHS_SHORT[end.getMonth()];

  if (startMonth === endMonth) {
    return `${start.getDate()} - ${end.getDate()} ${endMonth}`;
  }
  return `${start.getDate()} ${startMonth} - ${end.getDate()} ${endMonth}`;
}
