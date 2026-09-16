import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

export type InternalLocationId = "centrum" | "oost" | "depijp" | "boerejongens";

export interface DiscoveredLocation {
  /** Our internal id, matched by name — see matchInternalId(). */
  internalId: InternalLocationId | null;
  /** Google's resource name, e.g. "locations/12345678901234567890". */
  googleLocationId: string;
  name: string;
}

/** Matches a Google Business Profile location title to one of our three
 * known locations by substring. Assumes the real listing names contain
 * "Centrum" / "Oost" / "Pijp" — adjust here if the real names differ. */
function matchInternalId(title: string): InternalLocationId | null {
  const t = title.toLowerCase();
  if (t.includes("centrum")) return "centrum";
  if (t.includes("oost")) return "oost";
  if (t.includes("pijp")) return "depijp";
  return null;
}

async function listAccounts(auth: OAuth2Client) {
  const api = google.mybusinessaccountmanagement({ version: "v1", auth });
  const res = await api.accounts.list({});
  return res.data.accounts ?? [];
}

// The account-management quota is extremely tight by default (a handful of
// requests per minute), so cache the location list in memory for a few
// minutes rather than re-fetching it on every request that needs it.
let locationsCache: { data: DiscoveredLocation[]; fetchedAt: number } | null = null;
const LOCATIONS_CACHE_MS = 5 * 60 * 1000;

export async function listLocations(auth: OAuth2Client): Promise<DiscoveredLocation[]> {
  if (locationsCache && Date.now() - locationsCache.fetchedAt < LOCATIONS_CACHE_MS) {
    return locationsCache.data;
  }
  const result = await fetchLocations(auth);
  locationsCache = { data: result, fetchedAt: Date.now() };
  return result;
}

async function fetchLocations(auth: OAuth2Client): Promise<DiscoveredLocation[]> {
  const accounts = await listAccounts(auth);
  const info = google.mybusinessbusinessinformation({ version: "v1", auth });

  const out: DiscoveredLocation[] = [];
  for (const account of accounts) {
    if (!account.name) continue;
    const res = await info.accounts.locations.list({
      parent: account.name,
      readMask: "name,title",
    });
    for (const loc of res.data.locations ?? []) {
      if (!loc.name || !loc.title) continue;
      out.push({
        internalId: matchInternalId(loc.title),
        googleLocationId: loc.name,
        name: loc.title,
      });
    }
  }
  return out;
}

const SEARCH_METRICS = [
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
] as const;

interface DateParts {
  year: number;
  month: number;
  day: number;
}

function toDateParts(d: Date): DateParts {
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function isoWeekLabel(d: Date): string {
  // ISO week number, formatted like the mock data's "W36".
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    );
  return `W${week}`;
}

/** Sums the two search-impression metrics per day, per location, then
 * buckets them into ISO weeks — matching the shape of the mock
 * SEARCH_VIEWS data so the frontend needs no changes to consume it. */
export async function getWeeklySearchViews(
  auth: OAuth2Client,
  locations: DiscoveredLocation[],
  weeks = 8,
): Promise<Record<string, Record<InternalLocationId, number>>> {
  const perf = google.businessprofileperformance({ version: "v1", auth });

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - weeks * 7);

  const weekly: Record<string, Record<InternalLocationId, number>> = {};

  for (const loc of locations) {
    if (!loc.internalId) continue;
    const res = await perf.locations.fetchMultiDailyMetricsTimeSeries({
      location: loc.googleLocationId,
      dailyMetrics: [...SEARCH_METRICS],
      "dailyRange.startDate.year": toDateParts(startDate).year,
      "dailyRange.startDate.month": toDateParts(startDate).month,
      "dailyRange.startDate.day": toDateParts(startDate).day,
      "dailyRange.endDate.year": toDateParts(endDate).year,
      "dailyRange.endDate.month": toDateParts(endDate).month,
      "dailyRange.endDate.day": toDateParts(endDate).day,
    });

    for (const series of res.data.multiDailyMetricTimeSeries ?? []) {
      for (const metricSeries of series.dailyMetricTimeSeries ?? []) {
        for (const dated of metricSeries.timeSeries?.datedValues ?? []) {
          if (!dated.date?.year || !dated.date.month || !dated.date.day) continue;
          const day = new Date(
            Date.UTC(dated.date.year, dated.date.month - 1, dated.date.day),
          );
          const week = isoWeekLabel(day);
          const value = Number(dated.value ?? 0);
          weekly[week] ??= { centrum: 0, oost: 0, depijp: 0, boerejongens: 0 };
          weekly[week][loc.internalId] += value;
        }
      }
    }
  }

  return weekly;
}
