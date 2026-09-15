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
