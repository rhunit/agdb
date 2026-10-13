import { useTheme } from "../hooks/useTheme";
import styles from "./ThemeToggle.module.css";

function SunIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="5" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.2" y1="4.2" x2="5.6" y2="5.6" />
        <line x1="18.4" y1="18.4" x2="19.8" y2="19.8" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.2" y1="19.8" x2="5.6" y2="18.4" />
        <line x1="18.4" y1="5.6" x2="19.8" y2="4.2" />
      </g>
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20 14.5a8 8 0 1 1-9-10.9 6.5 6.5 0 0 0 9 10.9Z" />
      <circle cx="7" cy="6" r="0.9" />
      <circle cx="4" cy="11" r="0.6" />
      <path d="M9 2.4l.6 1.4L11 4.4l-1.4.6L9 6.4l-.6-1.4L7 4.4l1.4-.6Z" />
    </svg>
  );
}

export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const isDark = theme === "dark";

  return (
    <div className={styles.row}>
      <span className={isDark ? styles.label : `${styles.label} ${styles.labelActive}`}>
        Light
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Schakel naar lichte modus" : "Schakel naar donkere modus"}
        className={isDark ? `${styles.track} ${styles.trackDark}` : styles.track}
        onClick={toggle}
      >
        <span className={isDark ? `${styles.knob} ${styles.knobDark}` : styles.knob}>
          {isDark ? <MoonIcon /> : <SunIcon />}
        </span>
      </button>
      <span className={isDark ? `${styles.label} ${styles.labelActive}` : styles.label}>
        Dark
      </span>
    </div>
  );
}
