import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { InternalLocationId } from "./googleBusinessProfile.js";

// Who sent which reply through the dashboard, and when. Google only knows
// that "the owner" replied, never which person, so this is our own record —
// kept on the persistent volume like the review history. Replies posted
// directly on Google (or through the dashboard before this existed) have
// no entry here.

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", ".data");
const LOG_FILE = join(DATA_DIR, "reply-log.json");

export interface ReplyLogEntry {
  reviewId: string;
  location: InternalLocationId;
  username: string;
  repliedAt: string;
}

function load(): ReplyLogEntry[] {
  if (!existsSync(LOG_FILE)) return [];
  try {
    return JSON.parse(readFileSync(LOG_FILE, "utf-8")) as ReplyLogEntry[];
  } catch {
    return [];
  }
}

export function recordReply(entry: Omit<ReplyLogEntry, "repliedAt">): ReplyLogEntry {
  const full: ReplyLogEntry = { ...entry, repliedAt: new Date().toISOString() };
  const log = load();
  log.push(full);
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(LOG_FILE, JSON.stringify(log, null, 2), "utf-8");
  return full;
}

/** Every recorded reply — a review answered (or re-answered) more than
 * once appears once per send; the frontend shows the latest. */
export function listReplyLog(): ReplyLogEntry[] {
  return load();
}
