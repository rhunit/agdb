import { useState, type FormEvent } from "react";
import { LOCATIONS } from "../data/mockData";
import type { NewWeeklyLogEntry } from "../lib/api";
import type { LocationId, LogType } from "../types";
import styles from "./WeeklyUpdateForm.module.css";

interface WeeklyUpdateFormProps {
  isLive: boolean;
  submitting: boolean;
  submitError: string | null;
  onSubmit: (input: NewWeeklyLogEntry) => Promise<boolean>;
}

export function WeeklyUpdateForm({
  isLive,
  submitting,
  submitError,
  onSubmit,
}: WeeklyUpdateFormProps) {
  const [location, setLocation] = useState<LocationId>(LOCATIONS[0].id);
  const [type, setType] = useState<LogType>("smoke");
  const [submitter, setSubmitter] = useState("");
  const [note, setNote] = useState("");
  const [justSaved, setJustSaved] = useState(false);

  if (!isLive) {
    return (
      <div className={styles.card}>
        <div className={styles.disabledNote}>
          Nieuwe regels toevoegen vereist een gekoppelde backend — start de
          server (<code>agdb/server</code>) en stel <code>VITE_API_BASE_URL</code>{" "}
          in om dit formulier te gebruiken.
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!submitter.trim() || !note.trim()) return;
    const ok = await onSubmit({ location, type, submitter, note });
    if (ok) {
      setNote("");
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 3000);
    }
  }

  return (
    <form className={styles.card} onSubmit={handleSubmit}>
      <div className={styles.title}>Nieuwe regel toevoegen</div>
      <div className={styles.sub}>
        Eén regel per update. Na versturen kan de regel niet meer worden
        aangepast — correcties horen als nieuwe regel.
      </div>

      <div className={styles.row}>
        <label className={styles.field}>
          <span className={styles.label}>LOCATIE</span>
          <select
            className={styles.select}
            value={location}
            onChange={(e) => setLocation(e.target.value as LocationId)}
          >
            {LOCATIONS.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>TYPE</span>
          <select
            className={styles.select}
            value={type}
            onChange={(e) => setType(e.target.value as LogType)}
          >
            <option value="smoke">Smoke Session</option>
            <option value="qr">QR-scan</option>
          </select>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>JOUW NAAM</span>
          <input
            className={styles.input}
            type="text"
            value={submitter}
            onChange={(e) => setSubmitter(e.target.value)}
            placeholder="Voor- en achternaam"
            required
          />
        </label>
      </div>

      <label className={styles.field}>
        <span className={styles.label}>OPMERKING</span>
        <textarea
          className={styles.textarea}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Wat is er besproken, hoeveel gasten, opvallende feedback…"
          rows={3}
          required
        />
      </label>

      <div className={styles.actions}>
        {submitError && <span className={styles.error}>{submitError}</span>}
        {justSaved && <span className={styles.success}>Toegevoegd ✓</span>}
        <button className={styles.submit} type="submit" disabled={submitting}>
          {submitting ? "Bezig…" : "Definitief vastleggen"}
        </button>
      </div>
    </form>
  );
}
