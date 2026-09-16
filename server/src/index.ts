import "dotenv/config";
import cors from "cors";
import express from "express";
import {
  buildConsentUrl,
  exchangeCodeForRefreshToken,
  getAuthorizedClient,
  isConnected,
} from "./googleAuth.js";
import { getWeeklySearchViews, listLocations } from "./googleBusinessProfile.js";
import { ACTIVE_LOCATIONS, getAllPlacesSummaries } from "./googlePlaces.js";
import { getWeeklyReviewGrowth, recordSnapshot } from "./placesHistoryStore.js";
import { appendWeeklyLogEntry, listWeeklyLog } from "./weeklyLogStore.js";

const app = express();
const PORT = Number(process.env.PORT ?? 8787);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true, googleConnected: isConnected() });
});

// One-time admin flow: open this in a browser, log in as an account that
// manages the Business Profile locations, and approve access.
app.get("/auth/google", (_req, res) => {
  res.redirect(buildConsentUrl());
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

const LOCATION_IDS = new Set(["centrum", "oost", "depijp", "boerejongens"]);
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
        "Vereist: location (centrum|oost|depijp|boerejongens), type (smoke|qr), submitter, note.",
    });
    return;
  }
  const entry = appendWeeklyLogEntry({
    location: location as "centrum" | "oost" | "depijp" | "boerejongens",
    type: type as "smoke" | "qr",
    submitter,
    note,
  });
  res.status(201).json(entry);
});

app.listen(PORT, () => {
  console.log(`Review Radar server listening on http://localhost:${PORT}`);
  console.log(
    isConnected()
      ? "Google Business Profile: connected"
      : `Google Business Profile: not connected — visit http://localhost:${PORT}/auth/google`,
  );
});
