import { useEffect, useState, type FormEvent } from "react";
import { useAccount } from "../hooks/useAccount";
import {
  createAccount,
  deleteAccount,
  fetchAccounts,
  updateAccount,
  type AccountListing,
  type Permission,
} from "../lib/api";
import { formatReviewTimestamp } from "../lib/format";
import styles from "./UsersPage.module.css";

const PERMISSION_OPTIONS: { value: Permission; label: string; hint: string }[] = [
  { value: "reply", label: "Reageren op reviews", hint: "inclusief AI-opzet" },
  { value: "ai", label: "AI-functies", hint: "AI-chat en AI-samenvatting" },
  { value: "admin", label: "Gebruikers beheren", hint: "deze pagina" },
];

const MIN_PASSWORD_LENGTH = 10;

// No look-alikes (0/O, 1/l/I), so a password can be read out or typed
// over by hand without mistakes.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint32Array(12));
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map((g) => g.join("")).join("-");
}

function rightsSummary(permissions: Permission[]): string {
  if (permissions.length === 0) return "Alleen bekijken";
  return PERMISSION_OPTIONS.filter((o) => permissions.includes(o.value))
    .map((o) => o.label)
    .join(", ");
}

/** Login details just created or reset, shown once so the admin can pass
 * them on — the server only keeps a hash, so they can't be looked up later. */
interface Handover {
  username: string;
  password: string;
  kind: "created" | "reset";
}

/** "Gebruikers": the superadmin (and anyone given "Gebruikers beheren")
 * creates logins, ticks what each may do, resets passwords and removes
 * people — no Northflank or shell needed. The server enforces the same
 * rules (server/src/accounts.ts). */
export function UsersPage() {
  const { account } = useAccount();
  const [accounts, setAccounts] = useState<AccountListing[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [handover, setHandover] = useState<Handover | null>(null);
  const [rowError, setRowError] = useState<{ username: string; error: string } | null>(null);
  const [busyRow, setBusyRow] = useState<string | null>(null);

  // New-user form
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [permissions, setPermissions] = useState<Permission[]>(["reply"]);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchAccounts().then((list) => {
      if (list) setAccounts(list);
      else setLoadFailed(true);
    });
  }, []);

  function replaceRow(updated: AccountListing) {
    setAccounts((prev) => prev?.map((a) => (a.username === updated.username ? updated : a)) ?? null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setFormError(null);
    const result = await createAccount(username.trim().toLowerCase(), password, permissions);
    setCreating(false);
    if (!result.ok) {
      setFormError(result.error);
      return;
    }
    setAccounts((prev) => [...(prev ?? []), result.data]);
    setHandover({ username: result.data.username, password, kind: "created" });
    setUsername("");
    setPassword("");
    setShowPassword(false);
    setPermissions(["reply"]);
  }

  async function togglePermission(row: AccountListing, permission: Permission) {
    const next = row.permissions.includes(permission)
      ? row.permissions.filter((p) => p !== permission)
      : [...row.permissions, permission];
    // Show the tick right away; put it back if saving fails.
    replaceRow({ ...row, permissions: next });
    setBusyRow(row.username);
    setRowError(null);
    const result = await updateAccount(row.username, { permissions: next });
    setBusyRow(null);
    if (result.ok) {
      replaceRow(result.data);
    } else {
      replaceRow(row);
      setRowError({ username: row.username, error: result.error });
    }
  }

  async function resetPassword(row: AccountListing) {
    if (!window.confirm(`Nieuw wachtwoord maken voor ${row.username}? Het oude werkt daarna niet meer.`)) {
      return;
    }
    const newPassword = generatePassword();
    setBusyRow(row.username);
    setRowError(null);
    const result = await updateAccount(row.username, { password: newPassword });
    setBusyRow(null);
    if (result.ok) setHandover({ username: row.username, password: newPassword, kind: "reset" });
    else setRowError({ username: row.username, error: result.error });
  }

  async function remove(row: AccountListing) {
    if (!window.confirm(`${row.username} verwijderen? Deze persoon kan daarna niet meer inloggen.`)) {
      return;
    }
    setBusyRow(row.username);
    setRowError(null);
    const result = await deleteAccount(row.username);
    setBusyRow(null);
    if (result.ok) {
      setAccounts((prev) => prev?.filter((a) => a.username !== row.username) ?? null);
      if (handover?.username === row.username) setHandover(null);
    } else {
      setRowError({ username: row.username, error: result.error });
    }
  }

  const passwordTooShort = password.length > 0 && password.length < MIN_PASSWORD_LENGTH;

  return (
    <div className={styles.wrap}>
      <div>
        <div className={styles.title}>Gebruikers</div>
        <div className={styles.subtitle}>
          Bepaal wie er kan inloggen en wat iemand mag. Zonder vinkjes kan iemand alles bekijken,
          maar niet reageren of de AI gebruiken.
        </div>
      </div>

      {handover && (
        <div className={styles.handover} role="status">
          <div className={styles.handoverTitle}>
            {handover.kind === "created"
              ? `Gebruiker ${handover.username} is aangemaakt`
              : `Nieuw wachtwoord voor ${handover.username}`}
          </div>
          <div className={styles.handoverText}>
            Geef deze gegevens door. Het wachtwoord wordt niet bewaard en is hierna niet meer te
            zien.
          </div>
          <div className={styles.credentials}>
            <span className={styles.credLabel}>Gebruikersnaam</span>
            <code className={styles.credValue}>{handover.username}</code>
            <span className={styles.credLabel}>Wachtwoord</span>
            <code className={styles.credValue}>{handover.password}</code>
          </div>
          <div className={styles.handoverActions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() =>
                navigator.clipboard
                  ?.writeText(
                    `Dashboard: ${window.location.origin}\nGebruikersnaam: ${handover.username}\nWachtwoord: ${handover.password}`,
                  )
                  .catch(() => undefined)
              }
            >
              Kopieer inloggegevens
            </button>
            <button type="button" className={styles.linkButton} onClick={() => setHandover(null)}>
              Sluiten
            </button>
          </div>
        </div>
      )}

      <form className={styles.card} onSubmit={submit} noValidate>
        <div className={styles.cardTitle}>Nieuwe gebruiker</div>
        <div className={styles.formGrid}>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="new-username">
              Gebruikersnaam
            </label>
            <input
              id="new-username"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="bijv. sanne"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              disabled={creating}
            />
            <span className={styles.help}>
              Dit is ook de naam bij &ldquo;Beantwoord door&rdquo;.
            </span>
          </div>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="new-password">
              Wachtwoord
            </label>
            <div className={styles.passwordRow}>
              <input
                id="new-password"
                className={styles.input}
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                disabled={creating}
              />
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  setPassword(generatePassword());
                  setShowPassword(true);
                }}
              >
                Genereer
              </button>
            </div>
            <span className={passwordTooShort ? styles.helpError : styles.help}>
              Minstens {MIN_PASSWORD_LENGTH} tekens.{" "}
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Verberg" : "Toon"}
              </button>
            </span>
          </div>
        </div>

        <fieldset className={styles.rights}>
          <legend className={styles.label}>Wat mag deze persoon?</legend>
          {PERMISSION_OPTIONS.map((option) => (
            <label key={option.value} className={styles.check}>
              <input
                type="checkbox"
                checked={permissions.includes(option.value)}
                onChange={() =>
                  setPermissions((prev) =>
                    prev.includes(option.value)
                      ? prev.filter((p) => p !== option.value)
                      : [...prev, option.value],
                  )
                }
                disabled={creating}
              />
              <span>
                {option.label} <span className={styles.hint}>· {option.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {formError && (
          <div className={styles.error} role="alert">
            {formError}
          </div>
        )}

        <div>
          <button
            type="submit"
            className={styles.primary}
            disabled={creating || !username.trim() || password.length < MIN_PASSWORD_LENGTH}
          >
            {creating ? "Aanmaken..." : "Gebruiker aanmaken"}
          </button>
        </div>
      </form>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Accounts</div>
        {loadFailed ? (
          <div className={styles.error}>De gebruikers konden niet worden geladen.</div>
        ) : !accounts ? (
          <div className={styles.help}>Laden...</div>
        ) : (
          <div className={styles.list}>
            {accounts.map((row) => {
              const isSelf = row.username === account?.username;
              const editable = row.source === "user" && !isSelf;
              const busy = busyRow === row.username;
              return (
                <div className={styles.row} key={row.username}>
                  <div className={styles.rowMain}>
                    <div className={styles.rowName}>
                      {row.username}
                      {row.source === "superadmin" && (
                        <span className={styles.badgeAdmin}>Superadmin</span>
                      )}
                      {row.source === "shared" && <span className={styles.badge}>Gedeelde login</span>}
                      {isSelf && <span className={styles.badge}>Jij</span>}
                    </div>
                    <div className={styles.rowMeta}>
                      {row.source === "user" && row.createdAt
                        ? `Aangemaakt ${formatReviewTimestamp(row.createdAt)}${row.createdBy ? ` door ${row.createdBy}` : ""}`
                        : "Ingesteld in Northflank"}
                    </div>
                  </div>

                  <div className={styles.rowRights}>
                    {editable ? (
                      PERMISSION_OPTIONS.map((option) => (
                        <label key={option.value} className={styles.checkSmall}>
                          <input
                            type="checkbox"
                            checked={row.permissions.includes(option.value)}
                            onChange={() => togglePermission(row, option.value)}
                            disabled={busy}
                          />
                          {option.label}
                        </label>
                      ))
                    ) : (
                      <span className={styles.rightsText}>
                        {row.source === "superadmin" ? "Alle rechten" : rightsSummary(row.permissions)}
                      </span>
                    )}
                  </div>

                  <div className={styles.rowActions}>
                    {editable && (
                      <>
                        <button
                          type="button"
                          className={styles.secondary}
                          disabled={busy}
                          onClick={() => resetPassword(row)}
                        >
                          Nieuw wachtwoord
                        </button>
                        <button
                          type="button"
                          className={styles.danger}
                          disabled={busy}
                          onClick={() => remove(row)}
                        >
                          Verwijderen
                        </button>
                      </>
                    )}
                  </div>

                  {rowError?.username === row.username && (
                    <div className={styles.rowError} role="alert">
                      {rowError.error}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
