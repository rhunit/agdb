import { useSyncExternalStore } from "react";

// The "Vernieuwen" button: bumping the token makes every live-data hook
// fetch again (see useLiveResource). Loads started for a refresh are
// counted, so the button can spin until all of them are back and
// "bijgewerkt" can show when the data was last actually fetched.

interface RefreshState {
  token: number;
  refreshing: boolean;
  lastLoadedAt: Date;
}

let state: RefreshState = { token: 0, refreshing: false, lastLoadedAt: new Date() };
let pending = 0;
const listeners = new Set<() => void>();

function set(next: Partial<RefreshState>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function triggerRefresh() {
  if (state.refreshing) return;
  set({ token: state.token + 1, refreshing: true });
  // Nothing may be listening on the current page (e.g. only cached data):
  // don't leave the button spinning forever.
  queueMicrotask(() => {
    if (pending === 0) set({ refreshing: false, lastLoadedAt: new Date() });
  });
}

/** Wraps one fetch so the refresh button knows when everything is back. */
export function trackLoad<T>(promise: Promise<T>): Promise<T> {
  pending++;
  return promise.finally(() => {
    pending--;
    if (pending === 0) set({ refreshing: false, lastLoadedAt: new Date() });
  });
}

export function useRefreshState(): RefreshState {
  return useSyncExternalStore(subscribe, () => state);
}
