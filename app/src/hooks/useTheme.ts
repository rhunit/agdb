import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ag-theme";

function systemPrefersDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

/** Explicit light/dark toggle, persisted in localStorage. With nothing
 * stored yet, the page already renders in the system's preferred scheme
 * (see the `prefers-color-scheme` block in index.css) — this hook only
 * tracks and writes an override once the person actually picks one, so
 * reading it never flashes the wrong theme on load. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(
    () => readStored() ?? (systemPrefersDark() ? "dark" : "light"),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private browsing / blocked storage — theme still applies for
        // this load, it just won't persist across visits.
      }
      return next;
    });
  }, []);

  return [theme, toggle];
}
