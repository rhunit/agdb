import { useState, type FormEvent } from "react";
import { useTheme } from "../hooks/useTheme";
import { login } from "../lib/api";
import styles from "./LoginScreen.module.css";

interface LoginScreenProps {
  onLoggedIn: () => void;
}

/** The dashboard's own login page, in house style — replaces the browser's
 * built-in Basic auth dialog, which can't be styled and has no logout.
 * Same accounts as before (DASHBOARD_USERS, see server/src/accounts.ts);
 * a successful login sets a 30-day session cookie. */
export function LoginScreen({ onLoggedIn }: LoginScreenProps) {
  // Applies the theme the person picked earlier, before the sidebar's
  // toggle (which normally does this) is ever on screen.
  useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const result = await login(username.trim(), password);
    if (result.ok) {
      onLoggedIn();
      return;
    }
    setSubmitting(false);
    setError(result.error);
    setPassword("");
  }

  return (
    <div className={styles.page}>
      <section className={styles.brandPanel} aria-label="Amsterdam Genetics">
        <div className={styles.brand}>
          <img className={styles.mark} src="/favicon.svg" alt="" />
          <div>
            <div className={styles.brandName}>
              <span>Dashboard</span>
              <span className={styles.betaBadge}>BETA</span>
            </div>
            <div className={styles.brandSub}>Amsterdam Genetics</div>
          </div>
        </div>

        <div className={styles.pitch}>
          <h1 className={styles.pitchTitle}>Alle reviews van je shops op één plek.</h1>
          <p className={styles.pitchText}>
            Nieuwe reviews, reacties en rapportages voor elke locatie, live uit Google.
          </p>
        </div>

        <div className={styles.quote}>
          <img
            className={styles.professorImg}
            src="https://www.amsterdamgenetics.com/wp-content/uploads/2023/10/2023_homepage_profh.jpg.webp"
            alt="Professor Harvest"
          />
          <div>
            Professor Harvest:
            <br />
            &ldquo;Get smart, before you grow.&rdquo;
          </div>
        </div>
      </section>

      <main className={styles.formPanel}>
        <form className={styles.card} onSubmit={submit} noValidate>
          <h2 className={styles.title}>Inloggen</h2>
          <p className={styles.subtitle}>Log in met je eigen account om verder te gaan.</p>

          {error && (
            <div className={styles.error} role="alert">
              {error}
            </div>
          )}

          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-username">
              Gebruikersnaam
            </label>
            <input
              id="login-username"
              className={styles.input}
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={submitting}
              autoFocus
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="login-password">
              Wachtwoord
            </label>
            <div className={styles.passwordWrap}>
              <input
                id="login-password"
                className={styles.input}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                required
              />
              <button
                type="button"
                className={styles.reveal}
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Wachtwoord verbergen" : "Wachtwoord tonen"}
                aria-pressed={showPassword}
              >
                {showPassword ? "Verberg" : "Toon"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={styles.submit}
            disabled={submitting || !username.trim() || !password}
          >
            {submitting ? "Bezig met inloggen..." : "Inloggen"}
          </button>

          <p className={styles.footnote}>Je blijft 30 dagen ingelogd op dit apparaat.</p>
        </form>
      </main>
    </div>
  );
}
