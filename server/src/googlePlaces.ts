import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { InternalLocationId } from "./googleBusinessProfile.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", ".data");
const CACHE_FILE = join(DATA_DIR, "places-cache.json");

// Interim data source: the Places API (New) needs only an API key (no
// OAuth, no manual Google approval) and can already surface a location's
// real average rating + total review count while we wait on Business
// Profile API access. It cannot tell us response status or exact weekly
// review counts, so we only use it for the average-score KPI.
//
// Text search matches across the whole of Google Maps, not just listings
// the account manages — a vague query can silently match a different,
// unrelated business. Only query locations where we have the exact name
// + full address confirmed by the user; a name-only guess is not safe
// enough to trust the resulting rating/review numbers.
const SEARCH_QUERIES: Partial<Record<InternalLocationId, string>> = {
  centrum: "Coffeeshop BIJ Amsterdam, Bonairestraat 78, 1058 XL Amsterdam",
};

/** Only fetch locations we have a verified query for — see note above. */
const ACTIVE_LOCATIONS = Object.keys(SEARCH_QUERIES) as InternalLocationId[];

interface PlaceCache {
  [locationId: string]: { placeId: string; resolvedAt: string };
}

function loadCache(): PlaceCache {
  if (!existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8")) as PlaceCache;
  } catch {
    return {};
  }
}

function saveCache(cache: PlaceCache): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf-8");
}

function requireApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new Error("Missing required env var: GOOGLE_PLACES_API_KEY");
  return key;
}

async function resolvePlaceId(
  locationId: InternalLocationId,
): Promise<string> {
  const query = SEARCH_QUERIES[locationId];
  if (!query) {
    throw new Error(`No verified Places query configured for "${locationId}"`);
  }

  const cache = loadCache();
  const cached = cache[locationId];
  if (cached) return cached.placeId;

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": requireApiKey(),
      "X-Goog-FieldMask": "places.id,places.displayName",
    },
    body: JSON.stringify({ textQuery: query }),
  });

  if (!res.ok) {
    throw new Error(`Places text search failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { places?: { id: string }[] };
  const placeId = data.places?.[0]?.id;
  if (!placeId) {
    throw new Error(`No place found for "${query}"`);
  }

  cache[locationId] = { placeId, resolvedAt: new Date().toISOString() };
  saveCache(cache);
  return placeId;
}

export interface PlaceReview {
  authorName: string;
  rating: number;
  text: string;
  relativeTime: string;
}

export interface PlaceSummary {
  rating: number | null;
  userRatingCount: number;
  reviews: PlaceReview[];
}

interface PlaceDetailsResponse {
  rating?: number;
  userRatingCount?: number;
  reviews?: {
    authorAttribution?: { displayName?: string };
    rating?: number;
    text?: { text?: string };
    relativePublishTimeDescription?: string;
  }[];
}

async function getPlaceDetails(placeId: string): Promise<PlaceSummary> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
    headers: {
      "X-Goog-Api-Key": requireApiKey(),
      "X-Goog-FieldMask": "rating,userRatingCount,reviews",
    },
  });

  if (!res.ok) {
    throw new Error(`Place details failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as PlaceDetailsResponse;

  return {
    rating: data.rating ?? null,
    userRatingCount: data.userRatingCount ?? 0,
    reviews: (data.reviews ?? []).map((r) => ({
      authorName: r.authorAttribution?.displayName ?? "Anoniem",
      rating: r.rating ?? 0,
      text: r.text?.text ?? "",
      relativeTime: r.relativePublishTimeDescription ?? "",
    })),
  };
}

export async function getAllPlacesSummaries(): Promise<
  Partial<Record<InternalLocationId, PlaceSummary>>
> {
  const entries = await Promise.all(
    ACTIVE_LOCATIONS.map(async (id) => {
      const placeId = await resolvePlaceId(id);
      return [id, await getPlaceDetails(placeId)] as const;
    }),
  );
  return Object.fromEntries(entries);
}
