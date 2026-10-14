import "dotenv/config";
import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildConsentUrl,
  exchangeCodeForRefreshToken,
  getAuthorizedClient,
  isConnected,
} from "./googleAuth.js";
import type { InternalLocationId } from "./googleBusinessProfile.js";
import { getWeeklySearchViews, listLocations } from "./googleBusinessProfile.js";
import {
  getAllBusinessReviews,
  getRecentBusinessReviews,
  listBusinessReviews,
  replyToReview,
} from "./googleBusinessReviews.js";
import { ACTIVE_LOCATIONS, getAllPlacesSummaries } from "./googlePlaces.js";
import { getWeeklyReviewGrowth, recordSnapshot } from "./placesHistoryStore.js";
import {
  diffAndRecordReviews,
  listRemovedReviews,
  listReviewEdits,
} from "./reviewHistoryStore.js";
import { appendWeeklyLogEntry, listWeeklyLog } from "./weeklyLogStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT ?? 8787);
const LOCATION_IDS = new Set(["centrum", "oost", "depijp", "boerejongens", "almere"]);

// Gates the whole app behind a single shared username/password when both
// are set — meant for a beta link handed to a small group, not real
// per-user auth. Unset in local dev, so nothing changes there.
function requireBetaAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const user = process.env.BETA_USER;
  const pass = process.env.BETA_PASSWORD;
  if (!user || !pass) {
    next();
    return;
  }
  const expected = `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
  if (req.headers.authorization === expected) {
    next();
    return;
  }
  res.set("WWW-Authenticate", 'Basic realm="AG Review Radar"');
  res.status(401).send("Authenticatie vereist.");
}

app.use(requireBetaAuth);
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, googleConnected: isConnected() });
});

// One-time admin flow: open this in a browser, log in as an account that
// manages the Business Profile locations, and approve access.
app.get("/auth/google", (_req, res) => {
  try {
    res.redirect(buildConsentUrl());
  } catch (err) {
    console.error(err);
    res.status(500).send(
      `Kan de Google-koppeling niet starten: ${(err as Error).message}. ` +
        "Controleer of GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET en " +
        "GOOGLE_REDIRECT_URI zijn ingesteld.",
    );
  }
});

app.get("/auth/google/callback", async (req, res) => {
  const code = req.query.code;
  if (typeof code !== "string") {
    res.status(400).send("Missing ?code from Google.");
    return;
  }
  try {
    await exchangeCodeForRefreshToken(code);
    res.send("Google Business Profile connected. You can close this tab.");
  } catch (err) {
    console.error(err);
    res.status(500).send(`Connect failed: ${(err as Error).message}`);
  }
});

app.get("/api/locations", async (_req, res) => {
  try {
    const auth = getAuthorizedClient();
    const locations = await listLocations(auth);
    res.json(locations);
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: (err as Error).message });
  }
});

app.get("/api/search-views", async (_req, res) => {
  try {
    const auth = getAuthorizedClient();
    const locations = await listLocations(auth);
    const weekly = await getWeeklySearchViews(auth, locations);
    res.json(weekly);
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: (err as Error).message });
  }
});

// Interim data source while Business Profile API access is pending: needs
// only GOOGLE_PLACES_API_KEY, no OAuth, no manual Google approval.
app.get("/api/places-summary", async (_req, res) => {
  try {
    const summaries = await getAllPlacesSummaries();
    for (const [location, summary] of Object.entries(summaries)) {
      recordSnapshot(location as (typeof ACTIVE_LOCATIONS)[number], summary.userRatingCount);
    }
    res.json(summaries);
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: (err as Error).message });
  }
});

// Week-over-week new-review counts, built from the review-count snapshots
// taken above — see placesHistoryStore.ts for why this needs no separate
// polling job and why the series starts out short.
app.get("/api/places-review-growth", (_req, res) => {
  res.json(getWeeklyReviewGrowth(ACTIVE_LOCATIONS));
});

// Real data source for the dashboard: last two weeks of reviews per
// location via the legacy v4 API (complete, correctly ordered, includes
// reply status) — confirmed working, replaces the Places-based review
// feed's 5-review relevance-ranked cap.
app.get("/api/business-reviews", async (_req, res) => {
  try {
    const auth = getAuthorizedClient();
    const locations = await listLocations(auth);
    const reviews = await getRecentBusinessReviews(auth, locations);
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: (err as Error).message });
  }
});

// Backs the "Alle reviews" page — the complete review history per
// location, not just the recent window /api/business-reviews uses for
// the dashboard's weekly stats and feed. Also the only point that ever
// sees a location's *complete* review set in one go, which is why edit/
// removal detection (see reviewHistoryStore.ts) piggybacks on it rather
// than the recent-window endpoint — a review missing from a 14-day
// window just means it's old, not removed.
app.get("/api/business-reviews-all", async (_req, res) => {
  try {
    const auth = getAuthorizedClient();
    const locations = await listLocations(auth);
    const reviews = await getAllBusinessReviews(auth, locations);
    for (const [location, list] of Object.entries(reviews)) {
      try {
        diffAndRecordReviews(location as InternalLocationId, list ?? []);
      } catch (err) {
        console.error(`diffAndRecordReviews failed for ${location}:`, err);
      }
    }
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: (err as Error).message });
  }
});

// Reviews we previously saw with different text/rating and a moved
// updateTime — see reviewHistoryStore.ts for why this can only ever
// start from the first time this ran, never recover edits from before.
app.get("/api/review-edits", (_req, res) => {
  res.json(listReviewEdits(Array.from(LOCATION_IDS) as InternalLocationId[]));
});

// Reviews we previously saw that are simply gone from a later full
// fetch — Google gives no reason (removed by Google, withdrawn by the
// reviewer, or anything else), so this only ever reports "gone", not why.
app.get("/api/review-removals", (_req, res) => {
  res.json(listRemovedReviews(Array.from(LOCATION_IDS) as InternalLocationId[]));
});

// Posts (or edits) the owner reply on one review. This writes straight to
// the public Google listing the moment it succeeds — any "are you sure"
// step belongs on the frontend before this is ever called.
app.post("/api/business-reviews/:location/:reviewId/reply", async (req, res) => {
  const { location, reviewId } = req.params;
  const { comment } = req.body ?? {};
  if (!LOCATION_IDS.has(location)) {
    res.status(400).json({
      error: "Onbekende locatie. Vereist: centrum|oost|depijp|boerejongens|almere.",
    });
    return;
  }
  if (typeof comment !== "string" || !comment.trim()) {
    res.status(400).json({ error: "Vereist: comment (niet leeg)." });
    return;
  }
  try {
    const auth = getAuthorizedClient();
    const locations = await listLocations(auth);
    const match = locations.find((l) => l.internalId === location);
    if (!match) {
      res.status(404).json({
        error: `Locatie "${location}" niet gevonden in de gekoppelde Business Profile-locaties.`,
      });
      return;
    }
    const reply = await replyToReview(
      auth,
      match.accountName,
      match.googleLocationId,
      reviewId,
      comment.trim(),
    );
    res.json(reply);
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: (err as Error).message });
  }
});

// Diagnostic-only: tries the legacy v4 reviews endpoint for one location
// and returns exactly what Google sent back (or its error), so this can
// be tested directly in a browser before anything is wired into the real
// dashboard. Not yet confirmed to work against this project's access —
// see googleBusinessReviews.ts for why.
app.get("/api/business-reviews-test", async (req, res) => {
  const locationParam = req.query.location;
  if (typeof locationParam !== "string") {
    res.status(400).json({
      error: "Vereist: ?location=centrum|oost|depijp|boerejongens|almere",
    });
    return;
  }
  try {
    const auth = getAuthorizedClient();
    const locations = await listLocations(auth);
    const match = locations.find((l) => l.internalId === locationParam);
    if (!match) {
      res.status(404).json({
        error: `Locatie "${locationParam}" niet gevonden in de gekoppelde Business Profile-locaties.`,
        discoveredLocations: locations,
      });
      return;
    }
    const reviews = await listBusinessReviews(
      auth,
      match.accountName,
      match.googleLocationId,
    );
    res.json({ location: match, reviewCount: reviews.length, reviews });
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: (err as Error).message });
  }
});

const LOG_TYPES = new Set(["smoke", "qr"]);

app.get("/api/weekly-log", (_req, res) => {
  res.json(listWeeklyLog());
});

// Append-only by design: no PUT/PATCH/DELETE route exists for this
// resource at all.
app.post("/api/weekly-log", (req, res) => {
  const { location, type, submitter, note } = req.body ?? {};
  if (
    typeof location !== "string" ||
    !LOCATION_IDS.has(location) ||
    typeof type !== "string" ||
    !LOG_TYPES.has(type) ||
    typeof submitter !== "string" ||
    !submitter.trim() ||
    typeof note !== "string" ||
    !note.trim()
  ) {
    res.status(400).json({
      error:
        "Vereist: location (centrum|oost|depijp|boerejongens|almere), type (smoke|qr), submitter, note.",
    });
    return;
  }
  const entry = appendWeeklyLogEntry({
    location: location as "centrum" | "oost" | "depijp" | "boerejongens" | "almere",
    type: type as "smoke" | "qr",
    submitter,
    note,
  });
  res.status(201).json(entry);
});

// Serves the built frontend from the same origin/port when it's been
// built alongside this server (see Dockerfile) — one deployable unit, one
// URL, no CORS to configure. Falls back to API-only if app/dist isn't
// there, so local `npm run dev` (frontend served separately by Vite) is
// unaffected.
const FRONTEND_DIST = join(__dirname, "..", "..", "app", "dist");
if (existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  app.get("*", (_req, res) => {
    res.sendFile(join(FRONTEND_DIST, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Review Radar server listening on http://localhost:${PORT}`);
  console.log(
    isConnected()
      ? "Google Business Profile: connected"
      : `Google Business Profile: not connected — visit http://localhost:${PORT}/auth/google`,
  );
});
