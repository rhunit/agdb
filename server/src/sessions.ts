import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { accountForSession, credentialStampFor, type Account } from "./accounts.js";

// Keeps someone logged in after the login page: a signed cookie holding
// the username, an expiry, and a fingerprint of the password it was made
// with (see accountForSession). Nothing is stored per session, so there's
// no session table to manage — the signing secret is the only state, and
// it lives on the persistent volume so a restart or deploy doesn't log
// everyone out. SESSION_SECRET on the deployment overrides it.

export const SESSION_COOKIE = "agdb_session";
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", ".data");
const SECRET_FILE = join(DATA_DIR, "session-secret");

let secret: Buffer | null = null;

function signingSecret(): Buffer {
  if (secret) return secret;
  if (process.env.SESSION_SECRET) {
    secret = Buffer.from(process.env.SESSION_SECRET, "utf-8");
  } else if (existsSync(SECRET_FILE)) {
    secret = Buffer.from(readFileSync(SECRET_FILE, "utf-8").trim(), "base64url");
  } else {
    secret = randomBytes(32);
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(SECRET_FILE, secret.toString("base64url"), { encoding: "utf-8", mode: 0o600 });
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("base64url");
}

export function createSessionToken(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      u: username,
      s: credentialStampFor(username) ?? "",
      exp: Date.now() + SESSION_MAX_AGE_MS,
    }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** The account a session cookie belongs to, or null when it's missing,
 * tampered with, expired, or no longer matches a current login. */
export function accountFromSessionToken(token: string | undefined): Account | null {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const { u, s, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8")) as {
      u: string;
      s: string;
      exp: number;
    };
    if (typeof exp !== "number" || exp < Date.now()) return null;
    return accountForSession(u, s);
  } catch {
    return null;
  }
}

export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of header?.split(";") ?? []) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return undefined;
}

// Slows down password guessing: after MAX_FAILURES wrong attempts for the
// same username from the same address, further attempts are refused for
// the rest of the window. In memory only — a restart clears it, which is fine.
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; since: number }>();

function failureKey(ip: string, username: string): string {
  return `${ip}|${username.toLowerCase()}`;
}

export function isLoginBlocked(ip: string, username: string): boolean {
  const entry = failures.get(failureKey(ip, username));
  if (!entry) return false;
  if (Date.now() - entry.since > FAILURE_WINDOW_MS) {
    failures.delete(failureKey(ip, username));
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

export function recordLoginFailure(ip: string, username: string): void {
  const key = failureKey(ip, username);
  const entry = failures.get(key);
  if (!entry || Date.now() - entry.since > FAILURE_WINDOW_MS) {
    failures.set(key, { count: 1, since: Date.now() });
  } else {
    entry.count++;
  }
}

export function clearLoginFailures(ip: string, username: string): void {
  failures.delete(failureKey(ip, username));
}
