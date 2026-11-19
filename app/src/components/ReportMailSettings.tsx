import { useEffect, useState } from "react";
import { fetchReportMail, saveReportMail, sendReportMailTest, type ReportMailStatus } from "../lib/api";
import { formatReviewTimestamp } from "../lib/format";
import styles from "./UsersPage.module.css";

const WEEKDAYS = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

/** Instellingen → "Weekrapport per e-mail": who gets the weekly report
 * (the same one as Rapportage → Exporteer naar PDF), on which day and at
 * what time; plus a test send. */
export function ReportMailSettings() {
  const [status, setStatus] = useState<ReportMailStatus | null>(null);
  const [failed, setFailed] = useState(false);
  const [recipients, setRecipients] = useState("");
  const [weekday, setWeekday] = useState(1);
  const [time, setTime] = useState("09:00");
  const [enabled, setEnabled] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  function fill(s: ReportMailStatus) {
    setStatus(s);
    setRecipients(s.recipients.join("\n"));
    setWeekday(s.weekday);
    setTime(s.time);
    setEnabled(s.enabled);
    setTestTo((prev) => prev || s.recipients[0] || "");
  }

  useEffect(() => {
    fetchReportMail().then((s) => (s ? fill(s) : setFailed(true)));
  }, []);

  const recipientList = recipients
    .split(/[\s,;]+/)
    .map((r) => r.trim())
    .filter(Boolean);

  async function save() {
    setBusy("save");
    setMessage(null);
    const result = await saveReportMail({ enabled, recipients: recipientList, weekday, time });
    setBusy(null);
    if (!result.ok) {
      setMessage({ ok: false, text: result.error });
      return;
    }
    fill(result.data);
    setMessage({ ok: true, text: result.data.enabled ? "Opgeslagen. Het weekrapport wordt automatisch verstuurd." : "Opgeslagen. Automatisch versturen staat uit." });
  }

  async function test() {
    setBusy("test");
    setMessage(null);
    const result = await sendReportMailTest(testTo);
    setBusy(null);
    if (!result.ok) {
      setMessage({ ok: false, text: `Test niet gelukt: ${result.error}` });
      return;
    }
    setStatus(result.data);
    setMessage({ ok: true, text: `Testmail met het rapport over ${result.data.result.period} verstuurd naar ${testTo}.` });
  }

  if (failed) {
    return (
      <div className={styles.card}>
        <div className={styles.cardTitle}>Weekrapport per e-mail</div>
        <div className={styles.error}>De instellingen konden niet worden geladen.</div>
      </div>
    );
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
      <div className={styles.cardTitle}>Weekrapport per e-mail</div>
      <div className={styles.help}>
        Elke week automatisch het rapport over de week ervoor (maandag t/m zondag), zoals bij Rapportage →
        Exporteer naar PDF: in de mail zelf en als PDF-bijlage. Verstuurd vanaf rapport@amsterdamgenetics.com.
      </div>
      {status && !status.configured && (
        <div className={styles.error}>
          Nog niet gekoppeld: RESEND_API_KEY ontbreekt in de omgeving van de server (Northflank).
        </div>
      )}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="report-recipients">
          Ontvangers
        </label>
        <textarea
          id="report-recipients"
          className={`${styles.input} ${styles.textarea}`}
          value={recipients}
          rows={3}
          placeholder={"naam@amsterdamgenetics.com\nteam@boerejongens.com"}
          onChange={(e) => setRecipients(e.target.value)}
        />
        <span className={styles.help}>Eén adres per regel (of gescheiden door komma&apos;s). Iedere ontvanger krijgt een eigen mail.</span>
      </div>

      <div className={styles.formGrid}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="report-weekday">
            Dag
          </label>
          <select id="report-weekday" className={styles.input} value={weekday} onChange={(e) => setWeekday(Number(e.target.value))}>
            {WEEKDAYS.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="report-time">
            Tijd (Nederlandse tijd)
          </label>
          <input id="report-time" type="time" className={styles.input} value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      <label className={styles.check}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span>Actief — verstuur het weekrapport automatisch</span>
      </label>

      {message && (
        <div className={message.ok ? styles.hint : styles.error} role="status">
          {message.text}
        </div>
      )}

      <div>
        <button type="submit" className={styles.primary} disabled={busy !== null}>
          {busy === "save" ? "Opslaan..." : "Opslaan"}
        </button>
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="report-test">
          Test
        </label>
        <div className={styles.passwordRow}>
          <input
            id="report-test"
            type="email"
            className={styles.input}
            value={testTo}
            placeholder="jouw@e-mailadres.nl"
            onChange={(e) => setTestTo(e.target.value)}
          />
          <button type="button" className={styles.secondary} disabled={busy !== null || !testTo.trim()} onClick={test}>
            {busy === "test" ? "Versturen..." : "Stuur nu een test"}
          </button>
        </div>
        <span className={styles.help}>
          Stuurt het rapport over vorige week alleen naar dit adres. Duurt even (reviews ophalen en AI-teksten).
        </span>
      </div>

      {status && (
        <div className={styles.help}>
          {status.nextRun && <>Volgende verzending: {formatReviewTimestamp(status.nextRun)}. </>}
          {status.lastResult && (
            <>
              Laatst{status.lastResult.test ? " (test)" : ""}: {formatReviewTimestamp(status.lastResult.at)}, rapport{" "}
              {status.lastResult.period} — {status.lastResult.ok ? status.lastResult.message : `mislukt: ${status.lastResult.message}`}
            </>
          )}
        </div>
      )}
    </form>
  );
}
