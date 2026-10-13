import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ag-theme";

function readStored(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

/** Explicit light/dark toggle, persisted in localStorage. Light is the
 * hard default — the page does not follow the system's prefers-color-scheme
 * (see index.css), so it never opens dark just because the OS is set to
 * dark. Dark only applies once the person picks it here. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => readStored() ?? "light");

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
