import { useSyncExternalStore } from "react";

export type ApiFailureKind = "google-auth" | "login" | "timeout" | "network" | "server";

export interface ApiFailure {
  path: string;
  kind: ApiFailureKind;
  /** Raw detail (server error message or HTTP status) — shown small under
   * the friendly explanation, so it can be passed on when asking for help. */
  detail: string;
  at: Date;
}

// Every failed GET lands here (see getJson in ./api.ts) instead of being
// swallowed into a bare null — the hooks still get null back, but the
// banner and error states can now say *why* there's no data rather than
// spinning forever or quietly showing mock data.
const failures = new Map<string, ApiFailure>();
let snapshot: ApiFailure[] = [];
const listeners = new Set<() => void>();

function emit() {
  snapshot = Array.from(failures.values());
  for (const l of listeners) l();
}

export function recordApiFailure(path: string, kind: ApiFailureKind, detail: string) {
  failures.set(path, { path, kind, detail, at: new Date() });
  console.error(`[api] ${path} mislukt (${kind}): ${detail}`);
  emit();
}

export function clearApiFailure(path: string) {
  if (failures.delete(path)) emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useApiFailures(): ApiFailure[] {
  return useSyncExternalStore(subscribe, () => snapshot);
}

const GOOGLE_AUTH_ERRORS = [
  "invalid_grant",
  "invalid_client",
  "unauthorized_client",
  "not connected",
];

export function classifyServerError(status: number, message: string): ApiFailureKind {
  if (status === 401) return "login";
  const lower = message.toLowerCase();
  if (GOOGLE_AUTH_ERRORS.some((e) => lower.includes(e))) return "google-auth";
  return "server";
}

export function describeFailure(failure: ApiFailure): { title: string; action: string } {
  switch (failure.kind) {
    case "google-auth":
      if (failure.detail.toLowerCase().includes("invalid_client")) {
        return {
          title: "De koppeling met Google werkt niet meer",
          action:
            "Google herkent de OAuth-client niet. Controleer GOOGLE_CLIENT_ID en " +
            "GOOGLE_CLIENT_SECRET op Northflank en herstart de service.",
        };
      }
      return {
        title: "De koppeling met Google werkt niet meer",
        action:
          "Google weigert het opgeslagen token. Vraag een nieuw refresh-token aan, zet het op " +
          "Northflank als GOOGLE_REFRESH_TOKEN en herstart de service.",
      };
    case "login":
      return {
        title: "Je bent niet (meer) ingelogd",
        action: "Ververs de pagina en log opnieuw in.",
      };
    case "timeout":
      return {
        title: "De server reageert niet",
        action:
          "Het verzoek duurde te lang. Mogelijk is er een storing bij Northflank of Google — " +
          "check status.northflank.com en probeer het over een paar minuten opnieuw.",
      };
    case "network":
      return {
        title: "De server is niet bereikbaar",
        action:
          "Controleer je internetverbinding en of de service op Northflank draait " +
          "(status.northflank.com).",
      };
    case "server":
      return {
        title: "De server gaf een foutmelding",
        action: "Probeer het opnieuw. Blijft het misgaan, kijk dan in de logs op Northflank.",
      };
  }
}

/** The most important failure to explain first — a broken Google
 * connection explains every other failed call, so it wins. */
export function primaryFailure(list: ApiFailure[]): ApiFailure | null {
  const order: ApiFailureKind[] = ["login", "google-auth", "network", "timeout", "server"];
  for (const kind of order) {
    const hit = list.find((f) => f.kind === kind);
    if (hit) return hit;
  }
  return null;
}
