import { useEffect, useSyncExternalStore } from "react";
import { fetchNotice, type Notice } from "./api";

// The site-wide notice, fetched once per page load and shared, so saving it
// under Instellingen updates the banner at the top straight away.
let current: Notice | null = null;
let fetched = false;
const listeners = new Set<() => void>();

export function setNotice(next: Notice) {
  current = next;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useNotice(): Notice | null {
  useEffect(() => {
    if (fetched) return;
    fetched = true;
    fetchNotice().then((n) => {
      if (n) setNotice(n);
    });
  }, []);
  return useSyncExternalStore(subscribe, () => current);
}
