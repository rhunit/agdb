import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", ".data");
const TOKEN_FILE = join(DATA_DIR, "google-token.json");

interface StoredToken {
  refreshToken: string;
  connectedAt: string;
}

export function saveRefreshToken(refreshToken: string): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const payload: StoredToken = {
    refreshToken,
    connectedAt: new Date().toISOString(),
  };
  writeFileSync(TOKEN_FILE, JSON.stringify(payload, null, 2), "utf-8");
}

export function loadRefreshToken(): StoredToken | null {
  // Lets a refresh token obtained via the local-only /auth/google flow
  // (localhost is always an allowed OAuth redirect host, unlike a PaaS
  // wildcard-suffix domain such as Northflank's *.code.run) be carried
  // over to a deployment manually, without that deployment ever needing
  // its own working callback URL.
  const envToken = process.env.GOOGLE_REFRESH_TOKEN;
  if (envToken) {
    return { refreshToken: envToken, connectedAt: "env:GOOGLE_REFRESH_TOKEN" };
  }
  if (!existsSync(TOKEN_FILE)) return null;
  try {
    return JSON.parse(readFileSync(TOKEN_FILE, "utf-8")) as StoredToken;
  } catch {
    return null;
  }
}
