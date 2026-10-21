import { createHash, timingSafeEqual } from "node:crypto";
import {
  ALL_PERMISSIONS,
  hashPassword,
  loadUsers,
  normalizePermissions,
  saveUsers,
  verifyPassword,
  type Permission,
} from "./userStore.js";

// Who can log in, and what they may do. Three sources:
//
// - The superadmin: ADMIN_USER / ADMIN_PASSWORD on the deployment. Every
//   permission, including managing users on the "Gebruikers" page. Set in
//   Northflank once; can't be changed or removed from the dashboard, so
//   there's always a way back in.
// - The older shared login: BETA_USER / BETA_PASSWORD. Once a superadmin
//   exists it becomes view-only (general use); before that it keeps the
//   reply and AI permissions it always had.
// - Everyone else: created on the "Gebruikers" page (userStore.ts).
//
// With none of these set (local dev) the app is open. People log in
// through the dashboard's own login page, which keeps them logged in with
// a session cookie (see sessions.ts).

export { ALL_PERMISSIONS, type Permission };

export interface Account {
  username: string;
  permissions: Permission[];
}

export type AccountSource = "superadmin" | "shared" | "user";

interface ResolvedAccount {
  account: Account;
  source: AccountSource;
  /** What the session fingerprint is derived from — changes when the
   * password does, which ends sessions made with the old one. */
  credential: string;
  verify: (password: string) => boolean;
}

export const OPEN_ACCOUNT: Account = { username: "lokaal", permissions: [...ALL_PERMISSIONS] };

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function plainEquals(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

function superadmin(): { username: string; password: string } | null {
  const user = process.env.ADMIN_USER;
  const password = process.env.ADMIN_PASSWORD;
  return user && password ? { username: normalizeName(user), password } : null;
}

function sharedLogin(): { username: string; password: string } | null {
  const user = process.env.BETA_USER;
  const password = process.env.BETA_PASSWORD;
  return user && password ? { username: normalizeName(user), password } : null;
}

// scrypt is deliberately slow — a user's credentials that verified once
// are remembered (keyed by name, password and stored hash, so a password
// change invalidates it) instead of re-hashed on every login.
const verified = new Set<string>();

function resolve(username: string): ResolvedAccount | null {
  const name = normalizeName(username);
  const admin = superadmin();
  if (admin && name === admin.username) {
    return {
      account: { username: admin.username, permissions: [...ALL_PERMISSIONS] },
      source: "superadmin",
      credential: admin.password,
      verify: (pw) => plainEquals(pw, admin.password),
    };
  }
  const shared = sharedLogin();
  if (shared && name === shared.username) {
    return {
      account: { username: shared.username, permissions: admin ? [] : ["reply", "ai"] },
      source: "shared",
      credential: shared.password,
      verify: (pw) => plainEquals(pw, shared.password),
    };
  }
  const user = loadUsers().find((u) => u.username === name);
  if (!user) return null;
  return {
    account: { username: user.username, permissions: user.permissions },
    source: "user",
    credential: user.passwordHash,
    verify: (pw) => {
      const key = createHash("sha256").update(`${name}\0${pw}\0${user.passwordHash}`).digest("hex");
      if (verified.has(key)) return true;
      const ok = verifyPassword(pw, user.passwordHash);
      if (ok) verified.add(key);
      return ok;
    },
  };
}

export type AuthMode = "accounts" | "open";

export function authMode(): AuthMode {
  return superadmin() || sharedLogin() || loadUsers().length > 0 ? "accounts" : "open";
}

/** One line for the startup log saying how login is set up. */
export function describeLoginSetup(): string {
  if (authMode() === "open") {
    return "Login: uit (geen ADMIN_USER, BETA_USER of gebruikers ingesteld)";
  }
  const admin = superadmin();
  const shared = sharedLogin();
  const parts: string[] = [];
  if (admin) parts.push(`superadmin ${admin.username}`);
  if (shared) {
    parts.push(`gedeelde login ${shared.username} (${admin ? "alleen bekijken" : "reageren + AI"})`);
  }
  parts.push(`${loadUsers().length} gebruiker(s) uit het dashboard`);
  return `Login: ${parts.join(", ")}`;
}

/** The account a username/password logs in as, or null when they don't
 * match any login. */
export function checkCredentials(username: string, password: string): Account | null {
  if (authMode() === "open") return OPEN_ACCOUNT;
  const resolved = resolve(username);
  return resolved && resolved.verify(password) ? resolved.account : null;
}

/** Current account for a username from a session cookie — looked up fresh
 * each time, so a changed permission applies at once and a removed
 * account is logged out. `credentialStamp` is a short fingerprint of the
 * password the session was created with: changing a password ends every
 * session made with the old one. */
export function accountForSession(username: string, credentialStamp: string): Account | null {
  if (authMode() === "open") return OPEN_ACCOUNT;
  const resolved = resolve(username);
  if (!resolved || stampOf(resolved.credential) !== credentialStamp) return null;
  return resolved.account;
}

export function credentialStampFor(username: string): string | null {
  const resolved = resolve(username);
  return resolved ? stampOf(resolved.credential) : null;
}

function stampOf(credential: string): string {
  return createHash("sha256").update(credential).digest("base64url").slice(0, 12);
}

// ---- Managing users (the "Gebruikers" page; "admin" permission only) ----

export interface AccountListing {
  username: string;
  permissions: Permission[];
  source: AccountSource;
  createdAt: string | null;
  createdBy: string | null;
}

export function listAccounts(): AccountListing[] {
  const out: AccountListing[] = [];
  const admin = superadmin();
  const shared = sharedLogin();
  if (admin) {
    out.push({
      username: admin.username,
      permissions: [...ALL_PERMISSIONS],
      source: "superadmin",
      createdAt: null,
      createdBy: null,
    });
  }
  if (shared && shared.username !== admin?.username) {
    out.push({
      username: shared.username,
      permissions: resolve(shared.username)!.account.permissions,
      source: "shared",
      createdAt: null,
      createdBy: null,
    });
  }
  for (const u of loadUsers()) {
    out.push({
      username: u.username,
      permissions: u.permissions,
      source: "user",
      createdAt: u.createdAt,
      createdBy: u.createdBy,
    });
  }
  return out;
}

const NAME_PATTERN = /^[a-z0-9][a-z0-9._-]{1,31}$/;
export const MIN_PASSWORD_LENGTH = 10;

/** A problem with what the admin asked for — shown to them as-is (400). */
export class UserError extends Error {}

function checkPassword(password: unknown): string {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new UserError(`Kies een wachtwoord van minstens ${MIN_PASSWORD_LENGTH} tekens.`);
  }
  return password;
}

export function createUser(
  username: unknown,
  password: unknown,
  permissions: unknown,
  createdBy: string,
): AccountListing {
  const name = typeof username === "string" ? normalizeName(username) : "";
  if (!NAME_PATTERN.test(name)) {
    throw new UserError(
      "Kies een gebruikersnaam van 2-32 tekens: kleine letters, cijfers, punt, streepje of underscore.",
    );
  }
  if (resolve(name)) throw new UserError(`De gebruikersnaam "${name}" bestaat al.`);
  const user = {
    username: name,
    passwordHash: hashPassword(checkPassword(password)),
    permissions: normalizePermissions(permissions),
    createdAt: new Date().toISOString(),
    createdBy,
  };
  saveUsers([...loadUsers(), user]);
  return {
    username: name,
    permissions: user.permissions,
    source: "user",
    createdAt: user.createdAt,
    createdBy,
  };
}

/** Only users made on the Gebruikers page can be changed there, and never
 * your own account — that way no admin can lock themselves out. */
function editableUser(username: string, actingUser: string): string {
  const name = normalizeName(username);
  const resolved = resolve(name);
  if (!resolved) throw new UserError(`Gebruiker "${name}" bestaat niet.`);
  if (resolved.source === "superadmin") {
    throw new UserError("De superadmin beheer je in Northflank (ADMIN_USER / ADMIN_PASSWORD).");
  }
  if (resolved.source === "shared") {
    throw new UserError("De gedeelde login beheer je in Northflank (BETA_USER / BETA_PASSWORD).");
  }
  if (name === normalizeName(actingUser)) {
    throw new UserError("Je eigen account kun je hier niet wijzigen of verwijderen.");
  }
  return name;
}

export function updateUser(
  username: string,
  changes: { permissions?: unknown; password?: unknown },
  actingUser: string,
): AccountListing {
  const name = editableUser(username, actingUser);
  const users = loadUsers();
  const user = users.find((u) => u.username === name)!;
  if (changes.permissions !== undefined) user.permissions = normalizePermissions(changes.permissions);
  if (changes.password !== undefined) user.passwordHash = hashPassword(checkPassword(changes.password));
  saveUsers(users);
  return {
    username: name,
    permissions: user.permissions,
    source: "user",
    createdAt: user.createdAt,
    createdBy: user.createdBy,
  };
}

export function deleteUser(username: string, actingUser: string): void {
  const name = editableUser(username, actingUser);
  saveUsers(loadUsers().filter((u) => u.username !== name));
}
