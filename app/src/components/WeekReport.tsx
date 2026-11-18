import { createPortal } from "react-dom";
import { type DateRange } from "../lib/dateRange";
import type { StarCounts } from "../lib/reportCalc";
import {
  categoryTable,
  CLOSING_TEXT,
  countTotal,
  formatAverage,
  formatFivePct,
  formatPeriod,
  isWeekLong,
  negativeCountSentence,
  overviewSentence,
  numberWord,
  REPORT_CATEGORIES,
  starSentence,
  type ReportCategory,
} from "../lib/weekReport";
import type { LocationId, Review } from "../types";
import styles from "./WeekReport.module.css";

export interface WeekReportLocationData {
  id: LocationId;
  name: string;
  reviews: Review[];
  counts: StarCounts;
}

export interface WeekReportData {
  range: DateRange;
  locations: WeekReportLocationData[];
  /** From the AI; null when it's off or failed (then keyword categories, no narratives). */
  texts: {
    locations: Record<string, { narrative: string; categories: Record<string, string[]> }>;
  } | null;
  removedInPeriod: number;
  /** Fallback categories when the AI didn't give any. */
  keywordCategories: (r: Review) => ReportCategory[];
}

const STARS = [5, 4, 3, 2, 1] as const;

/** The PDF layout of Rapportage — "Google Reviews | Samen sterk", after the
 * business's own weekly report. Rendered outside the app (a portal on
 * <body>) and only visible when printing; see Rapportage's export button. */
export function WeekReport({ data }: { data: WeekReportData }) {
  const { range, locations, texts } = data;
  const period = formatPeriod(range);
  const total: StarCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const l of locations) for (const s of STARS) total[s] += l.counts[s];

  const categoriesOf = (loc: WeekReportLocationData) => (r: Review): ReportCategory[] => {
    const fromAi = r.googleReviewId ? texts?.locations[loc.id]?.categories[r.googleReviewId] : undefined;
    const valid = (fromAi ?? []).filter((c): c is ReportCategory => REPORT_CATEGORIES.includes(c as ReportCategory));
    return valid.length > 0 ? valid : data.keywordCategories(r);
  };

  const removedNote =
    data.removedInPeriod > 0
      ? ` In deze periode zijn ${data.removedInPeriod} review${data.removedInPeriod === 1 ? "" : "s"} als verwijderd gedetecteerd; die tellen hier niet mee.`
      : "";

  return createPortal(
    <div className={styles.report} data-week-report>
      {/* A table whose header and footer repeat on every printed page gives
          each page its top and bottom margin — the page itself has none, so
          the browser has no room for its own date/title/URL lines. */}
      <table className={styles.pageTable}>
        <thead>
          <tr>
            <td>
              <div className={styles.pageSpace} />
            </td>
          </tr>
        </thead>
        <tfoot>
          <tr>
            <td>
              <div className={styles.pageSpace} />
            </td>
          </tr>
        </tfoot>
        <tbody>
          <tr>
            <td className={styles.pageBody}>
      <h1 className={styles.title}>GOOGLE REVIEWS | SAMEN STERK</h1>
      <p className={styles.subtitle}>
        Gezamenlijk {isWeekLong(range) ? "weekrapport" : "rapport"} · {period} · Voor alle{" "}
        {numberWord(locations.length)} de teams
      </p>

      <h2 className={styles.h2}>De week in één oogopslag</h2>
      <table className={`${styles.table} ${styles.glance}`}>
        <thead>
          <tr>
            <th>Locatie</th>
            {STARS.map((s) => (
              <th key={s}>{s}★</th>
            ))}
            <th>Totaal</th>
            <th>Gem.</th>
            <th>5★ %</th>
          </tr>
        </thead>
        <tbody>
          {locations.map((l) => (
            <tr key={l.id}>
              <td>{l.name}</td>
              {STARS.map((s) => (
                <td key={s}>{l.counts[s]}</td>
              ))}
              <td>{countTotal(l.counts)}</td>
              <td>{formatAverage(l.counts)}</td>
              <td>{formatFivePct(l.counts)}</td>
            </tr>
          ))}
          <tr>
            <td>Totaal beschikbaar</td>
            {STARS.map((s) => (
              <td key={s}>{total[s]}</td>
            ))}
            <td>{countTotal(total)}</td>
            <td>{formatAverage(total)}</td>
            <td>{formatFivePct(total)}</td>
          </tr>
        </tbody>
      </table>
      <p className={styles.text}>{overviewSentence(locations)}</p>

      {locations.map((loc) => {
        const table = categoryTable(loc.reviews, categoriesOf(loc));
        const countSentence = negativeCountSentence(loc.reviews, table);
        const narrative = texts?.locations[loc.id]?.narrative ?? "";
        const paragraph = [countSentence, narrative].filter(Boolean).join(" ");
        return (
          <section key={loc.id} className={styles.section}>
            {/* Heading, sentence and table stay on one page. */}
            <div className={styles.keep}>
              <h2 className={styles.h2}>{loc.name}</h2>
              <p className={styles.text}>{starSentence(loc.counts)}</p>
              {countTotal(loc.counts) > 0 && (
                <table className={`${styles.table} ${styles.categories}`}>
                  <thead>
                    <tr>
                      <th>Categorie</th>
                      <th>1★</th>
                      <th>2★</th>
                      <th>3★</th>
                      <th>Totaal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {REPORT_CATEGORIES.map((c) => (
                      <tr key={c}>
                        <td>{c}</td>
                        <td>{table[c][1]}</td>
                        <td>{table[c][2]}</td>
                        <td>{table[c][3]}</td>
                        <td>{table[c][1] + table[c][2] + table[c][3]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {countTotal(loc.counts) > 0 && paragraph && <p className={styles.text}>{paragraph}</p>}
          </section>
        );
      })}

      <section className={styles.section}>
        <h2 className={styles.h2}>Datakwaliteit en vergelijkbaarheid</h2>
        <p className={styles.text}>
          Bron: Google Business Profile, reviews met aanmaakdatum {period}. De cijfers zijn
          momentopnamen van de beschikbare reviewrecords.{removedNote} Vergelijkingen met de vorige
          week zijn hier niet opgenomen. Negatieve reviews kunnen meerdere inhoudelijke categorieën
          raken, maar tellen in het sterrentotaal slechts één keer mee.
          {texts
            ? " Letterlijke klantcitaten zijn bewust beperkt; samenvattingen onderscheiden klantmeningen van vastgestelde feiten."
            : " De categorieën zijn in deze versie automatisch op trefwoorden ingedeeld."}
        </p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.h2}>Samen de nieuwe week in</h2>
        <p className={styles.text}>{CLOSING_TEXT}</p>
      </section>
            </td>
          </tr>
        </tbody>
      </table>
    </div>,
    document.body,
  );
}
