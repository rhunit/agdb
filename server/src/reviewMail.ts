import type { AllBusinessReviews, BusinessReview } from "./googleBusinessReviews.js";
import { MailError, parseRecipients, sendEmail } from "./mailer.js";
import { amsterdamDay, formatPeriod, REPORT_LOCATIONS, type ReportPeriod } from "./reportContent.js";

// "Reviews mailen": the reviews of a chosen period, locations and star
// ratings, sent as plain text in the body of the mail (no attachment). The
// selection is made here from the server's own review list, not taken from
// the browser.

export interface ReviewMailSelection {
  period: ReportPeriod;
  locations: string[];
  stars: number[];
}

/** Only this many reviews go into one mail; the rest is summed up as "… en N meer". */
const MAX_REVIEWS = 500;

const TRANSLATED =
  /^\((?:Translated by Google|Vertaald door Google)\)\s*([\s\S]*?)\s*\((?:Original|Origineel)\)\s*([\s\S]*)$/i;

function stars(n: number): string {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function dutchDateTime(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function reviewLines(r: BusinessReview): string[] {
  const out = [`${stars(r.rating)}  ${r.reviewer}${r.createTime ? ` · ${dutchDateTime(r.createTime)}` : ""}`];
  const text = r.text.trim();
  const m = text.match(TRANSLATED);
  if (!text) out.push("(geen tekst, alleen sterren)");
  else if (m) {
    out.push(m[2].trim());
    if (m[1].trim()) out.push(`(Vertaling door Google: ${m[1].trim()})`);
  } else out.push(text);
  if (r.responded && r.replyText) out.push(`Jullie antwoord: ${r.replyText.trim()}`);
  return out;
}

export function validateSelection(input: unknown, available: string[]): ReviewMailSelection {
  const raw = (input ?? {}) as { start?: unknown; end?: unknown; locations?: unknown; stars?: unknown };
  const day = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof raw.start !== "string" || typeof raw.end !== "string" || !day.test(raw.start) || !day.test(raw.end) || raw.start > raw.end) {
    throw new MailError("Kies een geldig tijdvak.");
  }
  const locations = Array.isArray(raw.locations) ? raw.locations.filter((l): l is string => typeof l === "string" && available.includes(l)) : [];
  const starList = Array.isArray(raw.stars) ? [...new Set(raw.stars.filter((s): s is number => [1, 2, 3, 4, 5].includes(s as number)))] : [];
  if (locations.length === 0) throw new MailError("Kies minstens één locatie.");
  if (starList.length === 0) throw new MailError("Kies minstens één aantal sterren.");
  return { period: { start: raw.start, end: raw.end }, locations, stars: starList.sort((a, b) => b - a) };
}

export function buildReviewMail(selection: ReviewMailSelection, all: AllBusinessReviews, test: boolean) {
  const { period, locations, stars: starList } = selection;
  const inRange = (r: BusinessReview) => {
    if (!r.createTime) return false;
    const day = amsterdamDay(new Date(r.createTime));
    return day >= period.start && day <= period.end;
  };
  const groups = REPORT_LOCATIONS.filter((l) => locations.includes(l.id)).map((l) => ({
    name: l.name,
    reviews: (all.reviews[l.id as keyof typeof all.reviews] ?? [])
      .filter((r) => inRange(r) && starList.includes(r.rating))
      .sort((a, b) => ((a.createTime ?? "") < (b.createTime ?? "") ? 1 : -1)),
  }));
  const count = groups.reduce((n, g) => n + g.reviews.length, 0);
  const periodLabel = formatPeriod(period);
  const starLabel = starList.length === 5 ? "alle sterren" : starList.map((s) => `${s}★`).join(", ");

  const lines = [
    `Reviews · ${periodLabel}`,
    `Locaties: ${groups.map((g) => g.name).join(", ")}`,
    `Sterren: ${starLabel}`,
    `Aantal: ${count} review${count === 1 ? "" : "s"}`,
    "",
  ];
  let left = MAX_REVIEWS;
  for (const g of groups) {
    lines.push(`— ${g.name} (${g.reviews.length}) —`, "");
    if (g.reviews.length === 0) {
      lines.push("Geen reviews in deze selectie.", "");
      continue;
    }
    for (const r of g.reviews) {
      if (left <= 0) break;
      lines.push(...reviewLines(r), "");
      left--;
    }
  }
  if (count > MAX_REVIEWS) {
    lines.push(`… en nog ${count - MAX_REVIEWS} review(s). Kies een kleiner tijdvak voor de volledige lijst.`, "");
  }
  lines.push("—", "Verstuurd vanuit het Amsterdam Genetics dashboard.");

  return {
    subject: `${test ? "[Test] " : ""}Reviews ${periodLabel} · ${starLabel}`,
    text: lines.join("\n"),
    count,
  };
}

/** Mails the selection to each recipient (one mail each). */
export async function sendReviewMail(
  to: unknown,
  selection: ReviewMailSelection,
  all: AllBusinessReviews,
  test: boolean,
): Promise<{ count: number; sent: string[]; failed: string[] }> {
  const recipients = parseRecipients(to, 10);
  if (recipients.length === 0) throw new MailError("Vul een e-mailadres in.");
  const mail = buildReviewMail(selection, all, test);
  const sent: string[] = [];
  const failed: string[] = [];
  for (const r of recipients) {
    try {
      await sendEmail({ to: r, subject: mail.subject, text: mail.text });
      sent.push(r);
    } catch (err) {
      failed.push(`${r}: ${(err as Error).message}`);
    }
  }
  console.log(`review mail${test ? " (test)" : ""}: ${mail.count} reviews to ${sent.length}/${recipients.length} — ${failed.join("; ")}`);
  return { count: mail.count, sent, failed };
}
