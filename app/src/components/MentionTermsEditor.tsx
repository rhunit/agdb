import { useState } from "react";
import { saveMentionTerms, type MentionTerm } from "../lib/api";
import styles from "./MentionsPage.module.css";

interface MentionTermsEditorProps {
  terms: MentionTerm[];
  onSaved: (terms: MentionTerm[]) => void;
}

interface Row {
  term: string;
  /** Comma-separated in the form, an array on the server. */
  exclude: string;
  matchCase: boolean;
  alertsFeedUrl: string;
}

function toRows(terms: MentionTerm[]): Row[] {
  return terms.map((t) => ({
    term: t.term,
    exclude: t.exclude.join(", "),
    matchCase: t.matchCase,
    alertsFeedUrl: t.alertsFeedUrl ?? "",
  }));
}

/** The admin's "Zoektermen" card: which names are tracked, words that mark
 * a hit as noise, case-sensitivity, and each term's Google Alerts feed. */
export function MentionTermsEditor({ terms, onSaved }: MentionTermsEditorProps) {
  const [rows, setRows] = useState<Row[]>(() => toRows(terms));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function update(index: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setMessage(null);
  }

  async function save() {
    setSaving(true);
    setMessage(null);
    const result = await saveMentionTerms(
      rows.map((r) => ({
        term: r.term,
        exclude: r.exclude.split(",").map((w) => w.trim()).filter(Boolean),
        matchCase: r.matchCase,
        alertsFeedUrl: r.alertsFeedUrl.trim() || null,
      })),
    );
    setSaving(false);
    if (!result.ok) {
      setMessage({ ok: false, text: result.error });
      return;
    }
    setRows(toRows(result.data.terms));
    onSaved(result.data.terms);
    setMessage({ ok: true, text: "Opgeslagen. Wordt meegenomen bij de volgende controle." });
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Zoektermen</div>
      <div className={styles.help}>
        Elke term moet letterlijk voorkomen. Uitsluitwoorden (met komma&apos;s) verbergen treffers die
        over iets anders gaan. Google Alerts: maak per term een melding op google.com/alerts, kies bij
        &ldquo;Bezorgen aan&rdquo; <strong>RSS-feed</strong> en plak de link van het RSS-icoon hier.
      </div>

      <div className={styles.termRows}>
        {rows.map((row, i) => (
          <div className={styles.termRow} key={i}>
            <label className={styles.termField}>
              <span className={styles.fieldLabel}>Zoekterm</span>
              <input
                className={styles.input}
                value={row.term}
                onChange={(e) => update(i, { term: e.target.value })}
              />
            </label>
            <label className={styles.termField}>
              <span className={styles.fieldLabel}>Uitsluiten</span>
              <input
                className={styles.input}
                value={row.exclude}
                placeholder="bijv. vacature, te koop"
                onChange={(e) => update(i, { exclude: e.target.value })}
              />
            </label>
            <label className={`${styles.termField} ${styles.termFieldWide}`}>
              <span className={styles.fieldLabel}>Google Alerts-feed</span>
              <input
                className={styles.input}
                value={row.alertsFeedUrl}
                placeholder="https://www.google.com/alerts/feeds/…"
                onChange={(e) => update(i, { alertsFeedUrl: e.target.value })}
              />
            </label>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={row.matchCase}
                onChange={(e) => update(i, { matchCase: e.target.checked })}
              />
              Hoofdlettergevoelig
            </label>
            <button
              type="button"
              className={styles.removeButton}
              onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
              aria-label={`${row.term || "Zoekterm"} verwijderen`}
            >
              Verwijderen
            </button>
          </div>
        ))}
      </div>

      {message && (
        <div className={message.ok ? styles.notice : styles.error} role="status">
          {message.text}
        </div>
      )}

      <div className={styles.termActions}>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() =>
            setRows((prev) => [...prev, { term: "", exclude: "", matchCase: false, alertsFeedUrl: "" }])
          }
        >
          + Zoekterm toevoegen
        </button>
        <button type="button" className={styles.checkButton} onClick={save} disabled={saving}>
          {saving ? "Opslaan..." : "Opslaan"}
        </button>
      </div>
    </div>
  );
}
