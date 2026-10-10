import { useTheme } from "../hooks/useTheme";
import styles from "./ThemeToggle.module.css";

export function ThemeToggle() {
  const [theme, toggle] = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggle}
      aria-label={isDark ? "Schakel naar lichte modus" : "Schakel naar donkere modus"}
    >
      <span className={styles.icon} aria-hidden="true">
        {isDark ? "☾" : "☀"}
      </span>
      {isDark ? "Dark" : "Light"}
    </button>
  );
}
