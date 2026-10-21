import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Named logins with per-account permissions, configured entirely through
// one env var on the deployment (no user database to manage):
//
//   DASHBOARD_USERS="rick:scrypt$…$…:reply,ai;medewerker:scrypt$…$…:"
//
// One entry per account, separated by ";" or a newline:
// username:passwordHash:permissions. The hash comes from
// `node server/dist/hashPassword.js <wachtwoord>` (see hashPassword.ts),
// so no plain password ever sits in the deployment's settings. An empty
// permissions list means read-only: the account can view everything but
// can't reply to reviews or use the AI features.
//
// Without DASHBOARD_USERS the older single shared BETA_USER/BETA_PASSWORD
// login keeps working (with every permission, as before), and with
// neither set (local dev) the app is open.
//
// People log in through the dashboard's own login page, which then keeps
// them logged in with a session cookie (see sessions.ts); a Basic auth
// header is still accepted too, for scripts and curl.

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

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltB64, hashB64] = stored.split("$");
  if (scheme !== "scrypt" || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, "base64url");
  const actual = scryptSync(password, Buffer.from(saltB64, "base64url"), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function parseAccounts(raw: string): ConfiguredAccount[] {
  const accounts: ConfiguredAccount[] = [];
  for (const entry of raw.split(/[;\n]/).map((e) => e.trim()).filter(Boolean)) {
    const [username, passwordHash, perms = ""] = entry.split(":");
    if (!username || !passwordHash?.startsWith("scrypt$")) {
      console.error(
        `DASHBOARD_USERS: ongeldige regel overgeslagen ("${username ?? ""}:…") — ` +
          "verwacht gebruikersnaam:scrypt$…$…:rechten",
      );
      continue;
    }
    const permissions = perms
      .split(",")
      .map((p) => p.trim())
      .filter((p): p is Permission => {
        if (!p) return false;
        if ((ALL_PERMISSIONS as string[]).includes(p)) return true;
        console.error(`DASHBOARD_USERS: onbekend recht "${p}" bij "${username}" genegeerd`);
        return false;
      });
    accounts.push({ username, passwordHash, permissions });
  }
  return accounts;
}

const configured = parseAccounts(process.env.DASHBOARD_USERS ?? "");

export type AuthMode = "accounts" | "beta" | "open";

export function authMode(): AuthMode {
  if (configured.length > 0) return "accounts";
  if (process.env.BETA_USER && process.env.BETA_PASSWORD) return "beta";
  return "open";
}

export function configuredAccountCount(): number {
  return configured.length;
}

export const OPEN_ACCOUNT: Account = { username: "lokaal", permissions: [...ALL_PERMISSIONS] };

// A Basic header arrives with every request a script makes, and scrypt is
// deliberately slow — so credentials that verified once are remembered by
// their digest instead of re-hashed each time.
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

  const match = configured.find((a) => a.username === username);
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

/** The account a Basic auth header logs in as (scripts/curl), or null. */
export function authenticateBasic(header: string | undefined): Account | null {
  if (!header?.startsWith("Basic ")) return null;
  const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
  const sep = decoded.indexOf(":");
  if (sep < 0) return null;
  return checkCredentials(decoded.slice(0, sep), decoded.slice(sep + 1));
}
