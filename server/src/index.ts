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

const app = express();
const PORT = Number(process.env.PORT ?? 8787);

app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173" }));

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

app.listen(PORT, () => {
  console.log(`Review Radar server listening on http://localhost:${PORT}`);
  console.log(
    isConnected()
      ? "Google Business Profile: connected"
      : `Google Business Profile: not connected — visit http://localhost:${PORT}/auth/google`,
  );
});
