import type { OAuth2Client } from "google-auth-library";

export type InternalLocationId =
  | "centrum"
  | "sloterdijk"
  | "west"
  | "boerejongens"
  | "almere"
  | "amsterdamgenetics";

export interface DiscoveredLocation {
  /** Our internal id, matched by name — see matchInternalId(). */
  internalId: InternalLocationId | null;
  /** Google's resource name, e.g. "locations/12345678901234567890". */
  googleLocationId: string;
  /** The owning account's resource name, e.g. "accounts/12345" — needed to
   * address the legacy v4 reviews endpoint (see googleBusinessReviews.ts). */
  accountName: string;
  name: string;
}

/** Matches a Google Business Profile location title to one of our real
 * locations by substring. "boerejongens" alone is ambiguous between
 * multiple Boerejongens listings, so every more-specific check (west,
 * almere, ...) must run before the generic fallback — a new Boerejongens
 * location added later needs its own check here too, or it silently
 * collapses into the generic "boerejongens" bucket and corrupts that
 * other location's review data. */
export function matchInternalId(title: string, address = ""): InternalLocationId | null {
  const t = title.toLowerCase();
  // The street settles the Boerejongens shops even when their profiles share
  // a title ("Boerejongens Coffeeshop"): Baarsjesweg is West, Utrechtsestraat
  // is Centrum.
  const a = address.toLowerCase();
  if (a.includes("baarsjesweg")) return "west";
  if (a.includes("utrechtsestraat")) return "boerejongens";
  if (t.includes("bij amsterdam")) return "centrum";
  if (t.includes("sloterdijk")) return "sloterdijk";
  if (t.includes("boerejongens") && t.includes("west")) return "west";
  if (t.includes("boerejongens") && t.includes("almere")) return "almere";
  if (t.includes("boerejongens")) return "boerejongens";
  // The brand's own profile — checked last so a store title that merely
  // mentions the brand still lands on that store.
  if (t.includes("amsterdam genetics")) return "amsterdamgenetics";
  return null;
}

/** One profile per internal id. The same location listed under two accounts
 * is kept once; two different profiles matching the same id keep the first
 * and leave the other unmatched — otherwise the second would overwrite the
 * first's reviews, and its missing reviews would read as removed. */
export function dedupe(locations: DiscoveredLocation[]): DiscoveredLocation[] {
  const seenLocation = new Set<string>();
  const seenId = new Map<InternalLocationId, string>();
  const out: DiscoveredLocation[] = [];
  for (const loc of locations) {
    const key = loc.googleLocationId;
    if (seenLocation.has(key)) continue;
    seenLocation.add(key);
    if (loc.internalId) {
      const first = seenId.get(loc.internalId);
      if (first) {
        console.warn(
          `locations: "${loc.name}" (${key}) also matches ${loc.internalId}, already "${first}" — left unmatched`,
        );
        out.push({ ...loc, internalId: null });
        continue;
      }
      seenId.set(loc.internalId, loc.name);
    }
    out.push(loc);
  }
  return out;
}

/** GET on a Google API with the stored OAuth token (plain fetch instead of
 * the googleapis package, which alone took ~100 MB of memory). */
async function googleGet<T>(auth: OAuth2Client, url: string): Promise<T> {
  const { token } = await auth.getAccessToken();
  if (!token) throw new Error("No access token available");
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Google API request failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

async function listAccounts(auth: OAuth2Client): Promise<{ name?: string }[]> {
  const out: { name?: string }[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL("https://mybusinessaccountmanagement.googleapis.com/v1/accounts");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const data = await googleGet<{ accounts?: { name?: string }[]; nextPageToken?: string }>(auth, url.toString());
    out.push(...(data.accounts ?? []));
    pageToken = data.nextPageToken ?? undefined;
  } while (pageToken);
  return out;
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

  const out: DiscoveredLocation[] = [];
  for (const account of accounts) {
    if (!account.name) continue;
    let pageToken: string | undefined;
    do {
      const url = new URL(`https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`);
      url.searchParams.set("readMask", "name,title,storefrontAddress");
      url.searchParams.set("pageSize", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const data = await googleGet<{
        locations?: {
          name?: string;
          title?: string;
          storefrontAddress?: { addressLines?: string[]; locality?: string; postalCode?: string };
        }[];
        nextPageToken?: string;
      }>(auth, url.toString());
      for (const loc of data.locations ?? []) {
        if (!loc.name || !loc.title) continue;
        const addr = loc.storefrontAddress;
        const address = [...(addr?.addressLines ?? []), addr?.locality ?? "", addr?.postalCode ?? ""].join(" ");
        out.push({
          internalId: matchInternalId(loc.title, address),
          googleLocationId: loc.name,
          accountName: account.name,
          name: loc.title,
        });
      }
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);
  }
  return dedupe(out);
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

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - weeks * 7);

  const weekly: Record<string, Record<InternalLocationId, number>> = {};

  for (const loc of locations) {
    if (!loc.internalId) continue;
    const url = new URL(
      `https://businessprofileperformance.googleapis.com/v1/${loc.googleLocationId}:fetchMultiDailyMetricsTimeSeries`,
    );
    for (const m of SEARCH_METRICS) url.searchParams.append("dailyMetrics", m);
    const s = toDateParts(startDate);
    const e = toDateParts(endDate);
    url.searchParams.set("dailyRange.startDate.year", String(s.year));
    url.searchParams.set("dailyRange.startDate.month", String(s.month));
    url.searchParams.set("dailyRange.startDate.day", String(s.day));
    url.searchParams.set("dailyRange.endDate.year", String(e.year));
    url.searchParams.set("dailyRange.endDate.month", String(e.month));
    url.searchParams.set("dailyRange.endDate.day", String(e.day));
    const data = await googleGet<{
      multiDailyMetricTimeSeries?: {
        dailyMetricTimeSeries?: {
          timeSeries?: { datedValues?: { date?: { year?: number; month?: number; day?: number }; value?: string }[] };
        }[];
      }[];
    }>(auth, url.toString());

    for (const series of data.multiDailyMetricTimeSeries ?? []) {
      for (const metricSeries of series.dailyMetricTimeSeries ?? []) {
        for (const dated of metricSeries.timeSeries?.datedValues ?? []) {
          if (!dated.date?.year || !dated.date.month || !dated.date.day) continue;
          const day = new Date(
            Date.UTC(dated.date.year, dated.date.month - 1, dated.date.day),
          );
          const week = isoWeekLabel(day);
          const value = Number(dated.value ?? 0);
          weekly[week] ??= {
            centrum: 0,
            sloterdijk: 0,
            west: 0,
            boerejongens: 0,
            almere: 0,
            amsterdamgenetics: 0,
          };
          weekly[week][loc.internalId] += value;
        }
      }
    }
  }

  return weekly;
}
