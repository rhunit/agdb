import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AllBusinessReviews } from "./googleBusinessReviews.js";
import type { InternalLocationId } from "./googleBusinessProfile.js";
import { listRemovedReviews } from "./reviewHistoryStore.js";
import {
  amsterdamDay,
  buildReportModel,
  formatPeriod,
  inPeriod,
  monthBlocks,
  previousWeek,
  REPORT_LOCATIONS,
  type ReportPeriod,
} from "./reportContent.js";
import { renderReportHtml } from "./reportHtml.js";
import { renderReportPdf } from "./reportPdf.js";
import { generateWeekReport, isWeekReportAvailable, type WeekReportResult } from "./weekReport.js";

// "Weekrapport per e-mail": every week, at a set day and time (Dutch time),
// the report over the previous week (Monday–Sunday) is mailed to the
// recipients an admin set under Instellingen — in the mail itself and as a
// PDF. Sent through Resend (RESEND_API_KEY), from rapport@amsterdamgenetics.com.
// Settings and what was sent last live on the persistent volume.

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", ".data");
const SETTINGS_FILE = join(DATA_DIR, "report-mail.json");

const FROM = process.env.REPORT_MAIL_FROM ?? "Amsterdam Genetics dashboard <rapport@amsterdamgenetics.com>";
const DASHBOARD_URL = process.env.DASHBOARD_URL ?? "https://dashboard.amsterdamgenetics.com";
const TZ = "Europe/Amsterdam";
/** A missed send (server down at the set time) is still made up to this long after it. */
const CATCH_UP_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 3;
const MAX_RECIPIENTS = 20;

export interface ReportMailResult {
  at: string;
  ok: boolean;
  /** "9 t/m 15 november 2026" */
  period: string;
  recipients: string[];
  /** How many of the recipients actually got it. */
  sent: number;
  message: string;
  test: boolean;
}

export interface ReportMailSettings {
  enabled: boolean;
  recipients: string[];
  /** 1 = Monday … 7 = Sunday */
  weekday: number;
  /** "09:00", Dutch time */
  time: string;
  /** Monday of the last week that was sent (or given up on). */
  lastSentWeek: string | null;
  attempts: number;
  lastResult: ReportMailResult | null;
  updatedBy: string | null;
}

const DEFAULTS: ReportMailSettings = {
  enabled: false,
  recipients: [],
  weekday: 1,
  time: "09:00",
  lastSentWeek: null,
  attempts: 0,
  lastResult: null,
  updatedBy: null,
};

export class ReportMailError extends Error {}

export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export function loadReportMailSettings(): ReportMailSettings {
  if (!existsSync(SETTINGS_FILE)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...(JSON.parse(readFileSync(SETTINGS_FILE, "utf-8")) as Partial<ReportMailSettings>) };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeSettings(s: ReportMailSettings): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), "utf-8");
}

const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[a-z]{2,}$/i;

export function parseRecipients(input: unknown): string[] {
  const list = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[\s,;]+/) : [];
  const out = [...new Set(list.map((x) => String(x).trim().toLowerCase()).filter(Boolean))];
  const bad = out.filter((e) => !EMAIL.test(e));
  if (bad.length > 0) throw new ReportMailError(`Geen geldig e-mailadres: ${bad.join(", ")}`);
  if (out.length > MAX_RECIPIENTS) throw new ReportMailError(`Maximaal ${MAX_RECIPIENTS} ontvangers.`);
  return out;
}

export function saveReportMailSettings(input: unknown, username: string): ReportMailSettings {
  const raw = (input ?? {}) as Partial<ReportMailSettings>;
  const recipients = parseRecipients(raw.recipients);
  const weekday = Number(raw.weekday);
  const time = typeof raw.time === "string" ? raw.time.trim() : "";
  if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) throw new ReportMailError("Kies een dag.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new ReportMailError("Kies een tijd als 09:00.");
  const enabled = raw.enabled === true;
  if (enabled && recipients.length === 0) throw new ReportMailError("Vul minstens één ontvanger in voordat je het aanzet.");
  const current = loadReportMailSettings();
  const next: ReportMailSettings = { ...current, enabled, recipients, weekday, time, updatedBy: username };
  // Switching it on (or moving the time) must not mail last week's report
  // straight away: count this week's slot as handled if it has passed.
  if (enabled && (!current.enabled || current.weekday !== weekday || current.time !== time)) {
    const slot = scheduledSlot(new Date(), weekday, time);
    if (slot && Date.now() >= slot.at.getTime()) {
      next.lastSentWeek = slot.week.start;
      next.attempts = 0;
    }
  }
  writeSettings(next);
  return next;
}

// ---- Time ----

/** The UTC moment of a Dutch wall-clock time on a "2026-11-16" day. */
function amsterdamTime(day: string, time: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  // Start from the same wall time read as UTC, then correct by the offset
  // Amsterdam has at that moment (CET +1 / CEST +2).
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm));
  const local = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(guess);
  const [lh, lm] = local.split(":").map(Number);
  const offsetMin = lh * 60 + lm - (hh * 60 + mm);
  const fixed = ((offsetMin + 720) % 1440) - 720;
  return new Date(guess.getTime() - fixed * 60_000);
}

/** This week's send moment and the week it reports on. */
function scheduledSlot(now: Date, weekday: number, time: string): { at: Date; week: ReportPeriod } | null {
  const today = amsterdamDay(now);
  const [y, m, d] = today.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
  const slotDay = new Date(Date.UTC(y, m - 1, d - (dow - weekday))).toISOString().slice(0, 10);
  const at = amsterdamTime(slotDay, time);
  return { at, week: previousWeek(at) };
}

/** When the next report goes out, for the settings card. */
export function nextRun(s: ReportMailSettings, now = new Date()): string | null {
  if (!s.enabled) return null;
  const slot = scheduledSlot(now, s.weekday, s.time);
  if (!slot) return null;
  if (s.lastSentWeek === slot.week.start || now.getTime() > slot.at.getTime() + CATCH_UP_MS) {
    return new Date(slot.at.getTime() + 7 * 86_400_000).toISOString();
  }
  return slot.at.toISOString();
}

// ---- Building and sending ----

type ReviewSource = () => Promise<AllBusinessReviews>;

async function buildReport(period: ReportPeriod, getReviews: ReviewSource) {
  const { reviews } = await getReviews();
  const locations = REPORT_LOCATIONS.filter((l) => reviews[l.id] !== undefined).map((l) => ({
    ...l,
    reviews: (reviews[l.id] ?? []).filter((r) => inPeriod(r.createTime, period)),
  }));
  const removedInPeriod = listRemovedReviews(locations.map((l) => l.id as InternalLocationId)).filter((r) =>
    inPeriod(r.detectedAt, period),
  ).length;

  let texts: WeekReportResult | null = null;
  if (isWeekReportAvailable()) {
    try {
      texts = await generateWeekReport({
        periodLabel: formatPeriod(period),
        locations: locations.map((l) => ({
          id: l.id,
          name: l.name,
          reviews: [
            ...l.reviews.filter((r) => r.rating <= 3).slice(0, 60),
            ...l.reviews.filter((r) => r.rating >= 4 && r.text.trim()).slice(0, 40),
          ].map((r) => ({ id: r.id, rating: r.rating, text: r.text.slice(0, 700) })),
        })),
      });
    } catch (err) {
      console.error("report mail: AI texts failed, sending without them:", (err as Error).message);
    }
  }
  const months = monthBlocks(period).map((block) => ({
    ...block,
    locations: REPORT_LOCATIONS.filter((l) => reviews[l.id] !== undefined).map((l) => ({
      name: l.name,
      reviews: (reviews[l.id] ?? []).filter((r) => inPeriod(r.createTime, block.period)),
    })),
  }));
  const model = buildReportModel(period, locations, texts, removedInPeriod, months);
  return { model, html: renderReportHtml(model, DASHBOARD_URL), pdf: await renderReportPdf(model) };
}

async function sendOne(to: string, subject: string, html: string, pdf: Buffer, filename: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new ReportMailError("RESEND_API_KEY ontbreekt in de omgeving van de server.");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [to],
      subject,
      html,
      attachments: [{ filename, content: pdf.toString("base64") }],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      message = (JSON.parse(body) as { message?: string }).message ?? body;
    } catch {
      // Not JSON: keep the text.
    }
    throw new ReportMailError(`Resend weigerde de mail (${res.status}): ${message.slice(0, 300)}`);
  }
}

/** Builds the report over `period` and mails it to each recipient (one mail
 * each, so nobody sees the others' addresses). */
export async function sendReport(
  period: ReportPeriod,
  recipients: string[],
  getReviews: ReviewSource,
  test: boolean,
): Promise<ReportMailResult> {
  const label = formatPeriod(period);
  const result: ReportMailResult = { at: new Date().toISOString(), ok: false, period: label, recipients, sent: 0, message: "", test };
  try {
    if (recipients.length === 0) throw new ReportMailError("Geen ontvangers ingesteld.");
    const { html, pdf } = await buildReport(period, getReviews);
    const subject = `${test ? "[Test] " : ""}Google Reviews weekrapport ${label}`;
    const filename = `Google Reviews weekrapport ${label}.pdf`;
    const failed: string[] = [];
    for (const to of recipients) {
      try {
        await sendOne(to, subject, html, pdf, filename);
        result.sent++;
      } catch (err) {
        failed.push(`${to}: ${(err as Error).message}`);
      }
    }
    result.ok = failed.length === 0;
    result.message = result.ok
      ? `Verstuurd naar ${recipients.length} ontvanger${recipients.length === 1 ? "" : "s"}.`
      : failed.length === recipients.length
        ? failed[0].replace(/^[^:]+: /, "")
        : `Niet verstuurd naar: ${failed.join("; ")}`;
  } catch (err) {
    result.message = (err as Error).message;
  }
  console.log(`report mail${test ? " (test)" : ""} ${label}: ${result.ok ? "ok" : "failed"} — ${result.message}`);
  return result;
}

let testRunning = false;

export function isTestRunning(): boolean {
  return testRunning;
}

/** Starts a test send in the background and returns at once: fetching every
 * review, the AI texts and the PDF can take longer than Northflank waits for
 * an answer (it then cut the request off with a bare 503). The settings card
 * polls the status until the result is in. */
export function startTestReport(to: string, getReviews: ReviewSource): void {
  const [recipient] = parseRecipients([to]);
  if (!recipient) throw new ReportMailError("Vul een e-mailadres in voor de test.");
  if (testRunning) throw new ReportMailError("Er loopt al een test; wacht even tot die klaar is.");
  testRunning = true;
  void sendTestReport(recipient, getReviews)
    .catch((err) => console.error("report mail test failed:", err))
    .finally(() => {
      testRunning = false;
    });
}

async function sendTestReport(recipient: string, getReviews: ReviewSource): Promise<ReportMailResult> {
  const result = await sendReport(previousWeek(new Date()), [recipient], getReviews, true);
  const s = loadReportMailSettings();
  writeSettings({ ...s, lastResult: result });
  return result;
}

// ---- Schedule ----

let running = false;

/** One check of the schedule (exported for tests). */
export async function tick(getReviews: ReviewSource, now = new Date()): Promise<void> {
  if (running || !isMailConfigured()) return;
  const s = loadReportMailSettings();
  if (!s.enabled || s.recipients.length === 0) return;
  const slot = scheduledSlot(now, s.weekday, s.time);
  if (!slot) return;
  const t = now.getTime();
  if (t < slot.at.getTime() || t > slot.at.getTime() + CATCH_UP_MS) return;
  if (s.lastSentWeek === slot.week.start) return;

  running = true;
  try {
    const result = await sendReport(slot.week, s.recipients, getReviews, false);
    const latest = loadReportMailSettings();
    // Done with this week once anyone got it (a retry would mail them
    // twice) — or after a few failed tries, so a broken setup doesn't retry
    // every few minutes forever.
    const attempts = result.sent > 0 ? 0 : latest.attempts + 1;
    const done = result.sent > 0 || attempts >= MAX_ATTEMPTS;
    writeSettings({
      ...latest,
      lastResult: result,
      lastSentWeek: done ? slot.week.start : latest.lastSentWeek,
      attempts: done ? 0 : attempts,
    });
  } finally {
    running = false;
  }
}

/** Checks every 5 minutes whether a report is due. */
export function scheduleReportMail(getReviews: ReviewSource): void {
  const run = () => void tick(getReviews).catch((err) => console.error("report mail tick failed:", err));
  setTimeout(run, 60_000);
  setInterval(run, 5 * 60_000);
}
