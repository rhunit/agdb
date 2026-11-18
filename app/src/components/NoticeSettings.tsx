import { useEffect, useState } from "react";
import { saveNotice } from "../lib/api";
import { formatReviewTimestamp } from "../lib/format";
import { setNotice, useNotice } from "../lib/notice";
import styles from "./UsersPage.module.css";

/** Instellingen → "Melding": the orange notice at the top of the dashboard,
 * for everyone. Title, description and on/off; saved on the server. */
export function NoticeSettings() {
  const notice = useNotice();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [active, setActive] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  // Fill the form once the saved notice is in (and after each save).
  useEffect(() => {
    if (!notice) return;
    const key = notice.updatedAt ?? "default";
    if (key === loadedFor) return;
    setLoadedFor(key);
    setTitle(notice.title);
    setDescription(notice.description);
    setActive(notice.active);
  }, [notice, loadedFor]);

  async function save(nextActive = active) {
    setSaving(true);
    setMessage(null);
    const result = await saveNotice({ title, description, active: nextActive });
    setSaving(false);
    if (!result.ok) {
      setMessage({ ok: false, text: result.error });
      return;
    }
    setNotice(result.data);
    setActive(result.data.active);
    setMessage({
      ok: true,
      text: result.data.active ? "Opgeslagen. De melding staat nu bovenaan voor iedereen." : "Opgeslagen. De melding staat uit.",
    });
  }

  return (
    <form
      className={styles.card}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
    >
      <div className={styles.cardTitle}>Melding bovenaan</div>
      <div className={styles.help}>
        Een oranje melding bovenaan het dashboard, voor iedereen die inlogt. Zet hem uit als hij niet
        meer nodig is; de tekst blijft dan bewaard.
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="notice-title">
          Titel
        </label>
        <input
          id="notice-title"
          className={styles.input}
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="bijv. Coffeeshop Sloterdijk is toegevoegd"
        />
      </div>
      <div className={styles.field}>
        <label className={styles.label} htmlFor="notice-description">
          Beschrijving
        </label>
        <textarea
          id="notice-description"
          className={`${styles.input} ${styles.textarea}`}
          value={description}
          maxLength={1000}
          rows={4}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <label className={styles.check}>
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
        <span>Actief — toon de melding bovenaan het dashboard</span>
      </label>
      {message && (
        <div className={message.ok ? styles.hint : styles.error} role="status">
          {message.text}
        </div>
      )}
      <div>
        <button type="submit" className={styles.primary} disabled={saving}>
          {saving ? "Opslaan..." : "Opslaan"}
        </button>
      </div>
      {notice?.updatedAt && (
        <div className={styles.help}>
          Laatst gewijzigd door {notice.updatedBy} op {formatReviewTimestamp(notice.updatedAt)}
        </div>
      )}
    </form>
  );
}
