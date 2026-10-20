import { google } from "googleapis";
import { loadRefreshToken, saveRefreshToken } from "./tokenStore.js";

const SCOPES = ["https://www.googleapis.com/auth/business.manage"];

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function createOAuthClient() {
  return new google.auth.OAuth2(
    requireEnv("GOOGLE_CLIENT_ID"),
    requireEnv("GOOGLE_CLIENT_SECRET"),
    requireEnv("GOOGLE_REDIRECT_URI"),
  );
}

export function buildConsentUrl(): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent", // forces a refresh_token on every connect, not just the first time
    scope: SCOPES,
  });
}

export async function exchangeCodeForRefreshToken(code: string): Promise<void> {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh_token. Revoke prior access at " +
        "https://myaccount.google.com/permissions and try connecting again.",
    );
  }
  saveRefreshToken(tokens.refresh_token);
}

export function isConnected(): boolean {
  return loadRefreshToken() !== null;
}

/** An OAuth2 client pre-loaded with the stored refresh token; mints its own
 * access tokens on demand. Throws if nobody has completed the connect flow yet. */
export function getAuthorizedClient() {
  const stored = loadRefreshToken();
  if (!stored) {
    throw new Error(
      "Google Business Profile is not connected yet. Visit /auth/google to connect.",
    );
  }
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: stored.refreshToken });
  return client;
}

export type GoogleConnectionStatus = { ok: true } | { ok: false; error: string };

// /health is polled (by people and possibly Northflank's health check),
// so the real token check is cached briefly instead of hitting Google's
// token endpoint on every request.
const STATUS_CACHE_MS = 5 * 60 * 1000;
// Bounded so /health itself can't hang when Google doesn't answer.
const STATUS_CHECK_TIMEOUT_MS = 10_000;
let cachedStatus: { status: GoogleConnectionStatus; at: number } | null = null;

/** Actually asks Google for an access token with the stored refresh token
 * — unlike isConnected(), which only knows a token is *stored*. This is
 * what catches an expired or revoked token (invalid_grant) or a deleted
 * OAuth client (invalid_client). */
export async function checkGoogleConnection(): Promise<GoogleConnectionStatus> {
  if (cachedStatus && Date.now() - cachedStatus.at < STATUS_CACHE_MS) {
    return cachedStatus.status;
  }
  let status: GoogleConnectionStatus;
  try {
    await Promise.race([
      getAuthorizedClient().getAccessToken(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`no answer from Google within ${STATUS_CHECK_TIMEOUT_MS / 1000} s`)),
          STATUS_CHECK_TIMEOUT_MS,
        ),
      ),
    ]);
    status = { ok: true };
  } catch (err) {
    status = { ok: false, error: (err as Error).message };
  }
  cachedStatus = { status, at: Date.now() };
  return status;
}
