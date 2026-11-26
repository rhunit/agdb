import { useMemo, useState } from "react";
import { LOCATION_TAB_LABEL, VISIBLE_LOCATION_IDS } from "../config";
import { sendReviewMail, type LiveBusinessReview } from "../lib/api";
import { formatRangeLabel, isWithinRange, rangeForPreset, type DateRange } from "../lib/dateRange";
import { formatReviewTimestamp } from "../lib/format";
import { businessReviewsFor, dateFromReview } from "../lib/reviews";
import type { LocationId, Review } from "../types";
import { StarRating } from "./badges";
import { DateRangeSelector } from "./DateRangeSelector";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";
import { ReviewText } from "./ReviewText";
import styles from "./UsersPage.module.css";
import own from "./ReviewMailPage.module.css";

const ALL_STARS = [5, 4, 3, 2, 1];
const PREVIEW_LIMIT = 30;
const TEST_KEY = "agdb.reviewMail.testTo";

function dayString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readTestAddress(): string {
  try {
    return localStorage.getItem(TEST_KEY) ?? "";
  } catch {
    return "";
  }
}

interface ReviewMailPageProps {
  reviewsByLocation: Partial<Record<LocationId, LiveBusinessReview[]>> | null;
  loading: boolean;
  failed: boolean;
}

/** "Reviews mailen": pick a period, locations and star ratings, see which
 * reviews match, and send them as plain text by e-mail (from
 * rapport@amsterdamgenetics.com). The server builds the mail itself from
 * the same review list. */
export function ReviewMailPage({ reviewsByLocation, loading, failed }: ReviewMailPageProps) {
  const [range, setRange] = useState<DateRange>(() => rangeForPreset("today"));
  const [locations, setLocations] = useState<LocationId[]>(VISIBLE_LOCATION_IDS);
  const [stars, setStars] = useState<number[]>(ALL_STARS);
  const [to, setTo] = useState("");
  const [testTo, setTestTo] = useState(readTestAddress);
  const [busy, setBusy] = useState<"send" | "test" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const matches = useMemo(() => {
    if (!reviewsByLocation) return [];
    const out: Review[] = [];
    for (const id of VISIBLE_LOCATION_IDS) {
      if (!locations.includes(id)) continue;
      const items = reviewsByLocation[id];
      if (!items) continue;
      out.push(
        ...businessReviewsFor(id, items).filter(
          (r) => stars.includes(r.rating) && isWithinRange(dateFromReview(r), range),
        ),
      );
    }
    return out.sort((a, b) => a.daysAgo - b.daysAgo);
  }, [reviewsByLocation, locations, stars, range]);

  function toggle<T>(list: T[], value: T, on: boolean): T[] {
    return on ? [...new Set([...list, value])] : list.filter((v) => v !== value);
  }

  async function send(test: boolean) {
    const address = (test ? testTo : to).trim();
    setMessage(null);
    if (!address) {
      setMessage({ ok: false, text: test ? "Vul een test-adres in." : "Vul een e-mailadres in." });
      return;
    }
    if (
      !test &&
      !window.confirm(
        `${matches.length} review${matches.length === 1 ? "" : "s"} versturen naar ${address}?`,
      )
    ) {
      return;
    }
    if (test) {
      try {
        localStorage.setItem(TEST_KEY, address);
      } catch {
        // Not remembered; fine.
      }
    }
    setBusy(test ? "test" : "send");
    const result = await sendReviewMail({
      to: address,
      start: dayString(range.start),
      end: dayString(range.end),
      locations,
      stars,
      test,
    });
    setBusy(null);
    if (!result.ok) {
      setMessage({ ok: false, text: `Niet verstuurd: ${result.error}` });
      return;
    }
    const { count, sent, failed: notSent } = result.data;
    setMessage({
      ok: notSent.length === 0,
      text:
        `${test ? "Testmail" : "Mail"} met ${count} review${count === 1 ? "" : "s"} verstuurd naar ${sent.join(", ")}.` +
        (notSent.length > 0 ? ` Niet gelukt: ${notSent.join("; ")}` : ""),
    });
  }

  const noLocations = locations.length === 0;
  const noStars = stars.length === 0;

  return (
    <div className={styles.wrap}>
      <div>
        <div className={styles.title}>Reviews mailen</div>
        <div className={styles.subtitle}>
          Kies een tijdvak, locaties en sterren, en stuur de reviews die daarbij horen als tekst in een e-mail.
          Verstuurd vanaf rapport@amsterdamgenetics.com.
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Selectie</div>

        <div className={styles.field}>
          <span className={styles.label}>Tijdvak</span>
          <div>
            <DateRangeSelector value={range} onChange={setRange} />
          </div>
        </div>

        <fieldset className={own.group}>
          <legend className={styles.label}>Locaties</legend>
          <div className={own.checks}>
            {VISIBLE_LOCATION_IDS.map((id) => (
              <label key={id} className={styles.check}>
                <input
                  type="checkbox"
                  checked={locations.includes(id)}
                  onChange={(e) => setLocations((prev) => toggle(prev, id, e.target.checked))}
                />
                <span>{LOCATION_TAB_LABEL[id]}</span>
              </label>
            ))}
          </div>
          <div className={own.quick}>
            <button type="button" className={own.link} onClick={() => setLocations(VISIBLE_LOCATION_IDS)}>
              Alle locaties
            </button>
            <button type="button" className={own.link} onClick={() => setLocations([])}>
              Geen
            </button>
          </div>
        </fieldset>

        <fieldset className={own.group}>
          <legend className={styles.label}>Sterren</legend>
          <div className={own.checks}>
            {ALL_STARS.map((n) => (
              <label key={n} className={styles.check}>
                <input
                  type="checkbox"
                  checked={stars.includes(n)}
                  onChange={(e) => setStars((prev) => toggle(prev, n, e.target.checked))}
                />
                <span>
                  {n} {n === 1 ? "ster" : "sterren"}
                </span>
              </label>
            ))}
          </div>
          <div className={own.quick}>
            <button type="button" className={own.link} onClick={() => setStars(ALL_STARS)}>
              Alle sterren
            </button>
            <button type="button" className={own.link} onClick={() => setStars([5])}>
              Alleen 5★
            </button>
          </div>
        </fieldset>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>
          {loading
            ? "Reviews laden…"
            : `${matches.length} review${matches.length === 1 ? "" : "s"} · ${formatRangeLabel(range)}`}
        </div>
        {failed ? (
          <ErrorState />
        ) : loading ? (
          <LoadingState />
        ) : noLocations || noStars ? (
          <div className={styles.help}>Kies minstens één locatie en één aantal sterren.</div>
        ) : matches.length === 0 ? (
          <div className={styles.help}>Geen reviews in deze selectie.</div>
        ) : (
          <div className={own.list}>
            {matches.slice(0, PREVIEW_LIMIT).map((r) => (
              <div key={r.id} className={own.item}>
                <div className={own.meta}>
                  <strong>{r.reviewer}</strong>
                  <StarRating rating={r.rating} />
                  <span className={own.muted}>
                    · {LOCATION_TAB_LABEL[r.location]}
                    {r.publishedAt ? ` · ${formatReviewTimestamp(r.publishedAt)}` : ""}
                  </span>
                </div>
                {r.snippet ? (
                  <ReviewText text={r.snippet} className={own.text} />
                ) : (
                  <div className={own.muted}>Geen tekst, alleen sterren.</div>
                )}
              </div>
            ))}
            {matches.length > PREVIEW_LIMIT && (
              <div className={styles.help}>
                … en nog {matches.length - PREVIEW_LIMIT}. Die gaan ook mee in de mail.
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Versturen</div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="review-mail-to">
            Naar
          </label>
          <div className={styles.passwordRow}>
            <input
              id="review-mail-to"
              type="text"
              inputMode="email"
              className={styles.input}
              value={to}
              placeholder="naam@voorbeeld.nl (meerdere: scheiden met een komma)"
              onChange={(e) => setTo(e.target.value)}
            />
            <button
              type="button"
              className={styles.primary}
              disabled={busy !== null || loading || noLocations || noStars}
              onClick={() => send(false)}
            >
              {busy === "send" ? "Versturen..." : "Versturen"}
            </button>
          </div>
          <span className={styles.help}>De reviews staan als tekst in de mail zelf, zonder bijlage.</span>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="review-mail-test">
            Test
          </label>
          <div className={styles.passwordRow}>
            <input
              id="review-mail-test"
              type="email"
              className={styles.input}
              value={testTo}
              placeholder="jouw@e-mailadres.nl"
              onChange={(e) => setTestTo(e.target.value)}
            />
            <button
              type="button"
              className={styles.secondary}
              disabled={busy !== null || loading || noLocations || noStars}
              onClick={() => send(true)}
            >
              {busy === "test" ? "Versturen..." : "Stuur test"}
            </button>
          </div>
          <span className={styles.help}>Dezelfde mail, met [Test] in het onderwerp, alleen naar dit adres.</span>
        </div>

        {message && (
          <div className={message.ok ? styles.hint : styles.error} role="status">
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}
