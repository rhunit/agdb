import "dotenv/config";
import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildConsentUrl,
  checkGoogleConnection,
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
import { generateReportSummary, isReportSummaryAvailable } from "./reportSummary.js";
import { generateChatReply, isAiChatAvailable, type ChatMessage } from "./aiChat.js";
import { appendWeeklyLogEntry, listWeeklyLog } from "./weeklyLogStore.js";
import {
  authMode,
  checkCredentials,
  configuredAccountNames,
  OPEN_ACCOUNT,
  type Account,
  type Permission,
} from "./accounts.js";
import {
  accountFromSessionToken,
  clearLoginFailures,
  createSessionToken,
  isLoginBlocked,
  readCookie,
  recordLoginFailure,
  SESSION_COOKIE,
  SESSION_MAX_AGE_MS,
} from "./sessions.js";
import { generateReplyDraft, isReplyDraftAvailable } from "./replyDraft.js";
import { listReplyLog, recordReply } from "./replyLogStore.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
// Northflank terminates HTTPS in front of the app; trusting its proxy
// makes req.secure / req.ip reflect the real visitor (secure cookies,
// per-address login throttling).
app.set("trust proxy", 1);
const PORT = Number(process.env.PORT ?? 8787);
const LOCATION_IDS = new Set([
  "centrum",
  "oost",
  "depijp",
  "boerejongens",
  "almere",
  "amsterdamgenetics",
]);

// The page itself (HTML/JS/CSS — no review data) is public so the login
// screen can load; everything that returns or changes data — /api, the
// Google connect flow, /health — needs a logged-in account, from the
// session cookie the login page sets. Basic auth is deliberately NOT
// accepted: browsers that once used the old Basic login keep re-sending
// those credentials until they're closed, which made "Uitloggen" a no-op.
// The account is kept on res.locals for the permission checks below.
// Open when no login is configured (local dev).
function needsLogin(path: string): boolean {
  if (path === "/api/login" || path === "/api/logout") return false;
  return path.startsWith("/api/") || path.startsWith("/auth/") || path === "/health";
}

function requireLogin(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  if (!needsLogin(req.path)) {
    next();
    return;
  }
  const account =
    authMode() === "open"
      ? OPEN_ACCOUNT
      : accountFromSessionToken(readCookie(req.headers.cookie, SESSION_COOKIE));
  if (account) {
    res.locals.account = account;
    next();
    return;
  }
  // No WWW-Authenticate header on purpose: that's what made browsers pop
  // up their own unstyled login dialog. The app shows its login page.
  res.status(401).json({ error: "Niet ingelogd." });
}

function sessionCookieOptions(req: express.Request): express.CookieOptions {
  return {
    httpOnly: true,
    secure: req.secure,
    // Lax: sent on normal navigation to the dashboard, never on another
    // site's form or fetch — which is what stops cross-site requests from
    // acting as the logged-in person.
    sameSite: "lax",
    path: "/",
  };
}

/** Blocks a route for accounts without `permission` — enforced here on the
 * server, so hiding a button in the frontend is never the only guard. */
function requirePermission(permission: Permission) {
  return (_req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (hasPermission(res, permission)) {
      next();
      return;
    }
    res.status(403).json({ error: "Je account heeft hier geen rechten voor." });
  };
}

function hasPermission(res: express.Response, permission: Permission): boolean {
  return (res.locals.account as Account | undefined)?.permissions.includes(permission) ?? false;
}

app.use(requireLogin);
app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173" }));
app.use(express.json());

// Always 200 while the server itself is up (so a platform health check
// doesn't restart it over a Google problem it can't fix) — googleConnected
// reflects a real token check, with Google's error when it fails.
app.post("/api/login", (req, res) => {
  const { username, password } = req.body ?? {};
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    res.status(400).json({ error: "Vul je gebruikersnaam en wachtwoord in." });
    return;
  }
  const ip = req.ip ?? "onbekend";
  if (isLoginBlocked(ip, username)) {
    res.status(429).json({
      error: "Te veel mislukte pogingen. Probeer het over een kwartier opnieuw.",
    });
    return;
  }
  const account = checkCredentials(username, password);
  if (!account) {
    recordLoginFailure(ip, username);
    res.status(401).json({ error: "Gebruikersnaam of wachtwoord klopt niet." });
    return;
  }
  clearLoginFailures(ip, username);
  res.cookie(SESSION_COOKIE, createSessionToken(account.username), {
    ...sessionCookieOptions(req),
    maxAge: SESSION_MAX_AGE_MS,
  });
  res.json({ username: account.username });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions(req));
  res.json({ ok: true });
});

// Who is logged in and what they may do — the frontend hides what an
// account can't use (the server still enforces it per route).
app.get("/api/me", (_req, res) => {
  const account = res.locals.account as Account;
  res.json({
    username: account.username,
    permissions: account.permissions,
    replyDraftAvailable: isReplyDraftAvailable(),
  });
});

app.get("/health", async (_req, res) => {
  const google = await checkGoogleConnection();
  res.json({
    ok: true,
    googleConnected: google.ok,
    ...(google.ok ? {} : { googleError: google.error }),
  });
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

// Who replied to which review through the dashboard, and when.
app.get("/api/reply-log", (_req, res) => {
  res.json(listReplyLog());
});

// Posts (or edits) the owner reply on one review. This writes straight to
// the public Google listing the moment it succeeds — any "are you sure"
// step belongs on the frontend before this is ever called.
app.post("/api/business-reviews/:location/:reviewId/reply", requirePermission("reply"), async (req, res) => {
  const { location, reviewId } = req.params;
  const { comment } = req.body ?? {};
  if (!LOCATION_IDS.has(location)) {
    res.status(400).json({
      error: "Onbekende locatie. Vereist: centrum|oost|depijp|boerejongens|almere|amsterdamgenetics.",
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
    // Google has now accepted the reply; record who sent it. A failure to
    // write the log must not turn a reply that's already public into an error.
    let logged = null;
    try {
      logged = recordReply({
        reviewId,
        location: location as InternalLocationId,
        username: (res.locals.account as Account).username,
      });
    } catch (err) {
      console.error("recordReply failed:", err);
    }
    res.json({ ...reply, logged });
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: (err as Error).message });
  }
});

// Whether an AI-written narrative summary can be generated at all — lets
// the frontend hide/disable the "Genereer samenvatting" button instead of
// letting someone click it and then hit a 501.
app.get("/api/report-summary-available", (_req, res) => {
  res.json({ available: isReportSummaryAvailable() && hasPermission(res, "ai") });
});

// Generates the narrative part of the Rapportage page (compliments,
// concerns, closing note) from the reviews the frontend already has
// loaded for the selected location/period — on demand only, never
// automatically, since it's a paid OpenAI API call. Grounded strictly in
// the review text it's given; see reportSummary.ts for the prompt.
app.post("/api/report-summary", requirePermission("ai"), async (req, res) => {
  if (!isReportSummaryAvailable()) {
    res.status(501).json({
      error: "AI-samenvatting staat uit (OPENAI_API_KEY of AI_ENABLED=true ontbreekt).",
    });
    return;
  }
  const { locationName, periodLabel, reviews } = req.body ?? {};
  if (
    typeof locationName !== "string" ||
    typeof periodLabel !== "string" ||
    !Array.isArray(reviews)
  ) {
    res.status(400).json({ error: "Vereist: locationName, periodLabel, reviews[]." });
    return;
  }
  try {
    const result = await generateReportSummary({ locationName, periodLabel, reviews });
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: (err as Error).message });
  }
});

// Writes a draft reply for one review following the business's reply
// rules (replyInstructions.ts). Part of replying, so it needs the "reply"
// permission; the draft is only ever put in the text field, never posted.
app.post("/api/reply-draft", requirePermission("reply"), async (req, res) => {
  if (!isReplyDraftAvailable()) {
    res.status(501).json({ error: "AI staat uit (OPENAI_API_KEY of AI_ENABLED=true ontbreekt)." });
    return;
  }
  const { location, reviewer, rating, text } = req.body ?? {};
  if (
    typeof location !== "string" ||
    !LOCATION_IDS.has(location) ||
    typeof reviewer !== "string" ||
    typeof rating !== "number" ||
    rating < 1 ||
    rating > 5 ||
    typeof text !== "string"
  ) {
    res.status(400).json({ error: "Vereist: location, reviewer, rating (1-5), text." });
    return;
  }
  try {
    const draft = await generateReplyDraft({
      location: location as InternalLocationId,
      reviewer,
      rating,
      text: text.slice(0, 5000),
    });
    res.json({ draft });
  } catch (err) {
    console.error(err);
    res.status(503).json({ error: (err as Error).message });
  }
});

// Whether the floating AI chat panel can be used at all — same
// OPENAI_API_KEY as the Rapportage summary.
app.get("/api/ai-chat-available", (_req, res) => {
  res.json({ available: isAiChatAvailable() && hasPermission(res, "ai") });
});

// A general-purpose chat turn for the floating AI panel. The frontend
// sends the whole conversation each time (nothing is persisted
// server-side), capped and trimmed in aiChat.ts, plus an optional
// `context` string — the aggregate dashboard stats currently on screen
// (see app/src/lib/aiChatContext.ts), never individual review text.
app.post("/api/ai-chat", requirePermission("ai"), async (req, res) => {
  if (!isAiChatAvailable()) {
    res.status(501).json({ error: "AI-chat staat uit (OPENAI_API_KEY of AI_ENABLED=true ontbreekt)." });
    return;
  }
  const { messages, context } = req.body ?? {};
  if (
    !Array.isArray(messages) ||
    messages.length === 0 ||
    !messages.every(
      (m: unknown) =>
        typeof m === "object" &&
        m !== null &&
        ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
        typeof (m as ChatMessage).content === "string",
    ) ||
    (context !== undefined && typeof context !== "string")
  ) {
    res.status(400).json({ error: "Vereist: messages[] met role en content; optioneel context." });
    return;
  }
  try {
    const reply = await generateChatReply(messages as ChatMessage[], context);
    res.json({ reply });
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
      error: "Vereist: ?location=centrum|oost|depijp|boerejongens|almere|amsterdamgenetics",
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
        "Vereist: location (centrum|oost|depijp|boerejongens|almere|amsterdamgenetics), type (smoke|qr), submitter, note.",
    });
    return;
  }
  const entry = appendWeeklyLogEntry({
    location: location as InternalLocationId,
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
  const mode = authMode();
  console.log(
    mode === "accounts"
      ? `Login: accounts ${configuredAccountNames().join(", ")} (DASHBOARD_USER_*)`
      : mode === "beta"
        ? "Login: gedeelde BETA_USER/BETA_PASSWORD (alle rechten)"
        : "Login: uit (geen DASHBOARD_USER_* of BETA_USER ingesteld)",
  );
  console.log(
    isConnected()
      ? "Google Business Profile: connected"
      : `Google Business Profile: not connected — visit http://localhost:${PORT}/auth/google`,
  );
  // A stored token can still be rejected (expired, revoked, wrong client)
  // — say so in the startup log rather than only on the first API call.
  if (isConnected()) {
    void checkGoogleConnection().then((google) => {
      if (!google.ok) console.error(`Google token rejected: ${google.error}`);
    });
  }
});
