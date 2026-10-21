import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Named logins with per-account permissions, configured entirely through
// env vars on the deployment (no user database to manage) — one variable
// per person, so adding or removing someone is adding or removing one row:
//
//   DASHBOARD_USER_SANNE = scrypt.<salt>.<hash>:reply
//   DASHBOARD_USER_AGDB  = scrypt.<salt>.<hash>:
//
// The part after DASHBOARD_USER_ is the login name (case-insensitive; shown
// in lowercase, e.g. in "Beantwoord door sanne"). The value is the password
// hash from `node server/dist/hashPassword.js` (see hashPassword.ts) — so no
// plain password ever sits in the deployment's settings — then ":" and the
// permissions. Empty permissions means view-only: the account can see
// everything but can't reply to reviews or use the AI features.
//
// Without any DASHBOARD_USER_* the older single shared BETA_USER/
// BETA_PASSWORD login keeps working (with every permission, as before),
// and with neither set (local dev) the app is open.
//
// People log in through the dashboard's own login page, which then keeps
// them logged in with a session cookie (see sessions.ts).

export type Permission = "reply" | "ai";
export const ALL_PERMISSIONS: Permission[] = ["reply", "ai"];

export interface Account {
  username: string;
  permissions: Permission[];
}

interface ConfiguredAccount extends Account {
  passwordHash: string;
}

const SCRYPT_KEYLEN = 32;

// "." separates the parts (base64url never contains one) rather than "$",
// which some platforms treat as a variable reference inside env values.
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt.${salt.toString("base64url")}.${hash.toString("base64url")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split(".");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64url"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const USER_VAR_PREFIX = "DASHBOARD_USER_";

function parseAccounts(env: NodeJS.ProcessEnv): ConfiguredAccount[] {
  const accounts: ConfiguredAccount[] = [];
  for (const [key, raw] of Object.entries(env)) {
    if (!key.startsWith(USER_VAR_PREFIX) || raw === undefined) continue;
    const username = key.slice(USER_VAR_PREFIX.length).toLowerCase();
    const [passwordHash = "", perms = ""] = raw.trim().split(":");
    if (!username || !passwordHash.startsWith("scrypt.")) {
      console.error(
        `${key}: overgeslagen — verwacht als waarde scrypt.….…:rechten ` +
          "(maak de hash met: node server/dist/hashPassword.js)",
      );
      continue;
    }
    const permissions = perms
      .split(",")
      .map((p) => p.trim().toLowerCase())
      .filter((p): p is Permission => {
        if (!p) return false;
        if ((ALL_PERMISSIONS as string[]).includes(p)) return true;
        console.error(`${key}: onbekend recht "${p}" genegeerd (gebruik reply en/of ai)`);
        return false;
      });
    accounts.push({ username, passwordHash, permissions });
  }
  return accounts.sort((a, b) => a.username.localeCompare(b.username));
}

const configured = parseAccounts(process.env);

export type AuthMode = "accounts" | "beta" | "open";

export function authMode(): AuthMode {
  if (configured.length > 0) return "accounts";
  if (process.env.BETA_USER && process.env.BETA_PASSWORD) return "beta";
  return "open";
}

export function configuredAccountNames(): string[] {
  return configured.map((a) => a.username);
}

export const OPEN_ACCOUNT: Account = { username: "lokaal", permissions: [...ALL_PERMISSIONS] };

// scrypt is deliberately slow — credentials that verified once are
// remembered by their digest instead of re-hashed on every login.
const verified = new Map<string, Account>();

/** The account a username/password logs in as, or null when they don't
 * match any configured login. */
export function checkCredentials(username: string, password: string): Account | null {
  const mode = authMode();
  if (mode === "open") return OPEN_ACCOUNT;
  if (mode === "beta") {
    return username === process.env.BETA_USER && password === process.env.BETA_PASSWORD
      ? { username, permissions: [...ALL_PERMISSIONS] }
      : null;
  }

  const key = createHash("sha256").update(`${username}\0${password}`).digest("hex");
  const cached = verified.get(key);
  if (cached) return cached;

  const match = configured.find((a) => a.username === username.toLowerCase());
  if (!match || !verifyPassword(password, match.passwordHash)) return null;
  const account = { username: match.username, permissions: match.permissions };
  verified.set(key, account);
  return account;
}

/** Current account for a username from a session cookie — looked up fresh
 * each time, so a changed permission applies at once and a removed
 * account is logged out. `credentialStamp` is a short fingerprint of the
 * password the session was created with: changing a password ends every
 * session made with the old one. */
export function accountForSession(username: string, credentialStamp: string): Account | null {
  const mode = authMode();
  if (mode === "open") return OPEN_ACCOUNT;
  if (credentialStampFor(username) !== credentialStamp) return null;
  if (mode === "beta") return { username, permissions: [...ALL_PERMISSIONS] };
  const match = configured.find((a) => a.username === username);
  return match ? { username: match.username, permissions: match.permissions } : null;
}

export function credentialStampFor(username: string): string | null {
  const mode = authMode();
  let secret: string | undefined;
  if (mode === "beta" && username === process.env.BETA_USER) secret = process.env.BETA_PASSWORD;
  if (mode === "accounts") secret = configured.find((a) => a.username === username)?.passwordHash;
  if (!secret) return null;
  return createHash("sha256").update(secret).digest("base64url").slice(0, 12);
}

