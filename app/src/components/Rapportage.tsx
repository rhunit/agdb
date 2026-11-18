import { useEffect, useMemo, useState } from "react";
import { LOCATION_TAB_LABEL, VISIBLE_LOCATION_IDS } from "../config";
import { LOCATIONS } from "../data/mockData";
import {
  fetchReportSummaryAvailable,
  generateReportSummary,
  generateWeekReport,
  type LiveBusinessReview,
  type RemovedReview,
  type ReportSummaryResult,
  type ReviewEdit,
} from "../lib/api";
import { isWithinRange, formatRangeLabel, rangeForPreset, type DateRange } from "../lib/dateRange";
import { formatDutchInt, formatReviewTimestamp } from "../lib/format";
import { useAccount } from "../hooks/useAccount";
import { describeEditChange } from "../lib/reviewHistory";
import { computePot, formatEur, starCounts, sumStarCounts, totalFromCounts } from "../lib/reportCalc";
import { businessReviewsFor, dateFromReview } from "../lib/reviews";
import { buildThemeStarBreakdown } from "../lib/reviewPatterns";
import type { LocationId, Review } from "../types";
import { DateRangeSelector } from "./DateRangeSelector";
import exportStyles from "./ExportPdfButton.module.css";
import { WeekReport, type WeekReportData } from "./WeekReport";
import { keywordCategories, REPORT_LOCATION_ORDER, formatPeriod } from "../lib/weekReport";
import { RefreshButton } from "./RefreshButton";
import { LoadingState } from "./LoadingState";
import styles from "./Rapportage.module.css";
import { ReviewText } from "./ReviewText";

const LOCATION_NAME = new Map(LOCATIONS.map((l) => [l.id, l.name]));
const STAR_COLUMNS = [5, 4, 3, 2, 1] as const;

interface RapportageProps {
  reviewsByLocation: Partial<Record<LocationId, LiveBusinessReview[]>> | null;
  isLive: boolean;
  loading: boolean;
  edits: ReviewEdit[] | null;
  removed: RemovedReview[] | null;
}

export function Rapportage({
  reviewsByLocation,
  isLive,
  loading,
  edits,
  removed,
}: RapportageProps) {
  const { can } = useAccount();
  const [locationTab, setLocationTab] = useState<LocationId | "all">("all");
  const [dateRange, setDateRange] = useState<DateRange>(() => rangeForPreset("7d"));
  const [summaryAvailable, setSummaryAvailable] = useState(false);
  const [summaryResult, setSummaryResult] = useState<ReportSummaryResult | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  // "Exporteer naar PDF": the report layout (WeekReport), filled and printed.
  const [report, setReport] = useState<WeekReportData | null>(null);
  const [preparingReport, setPreparingReport] = useState(false);
  const [reportNote, setReportNote] = useState<string | null>(null);

  useEffect(() => {
    fetchReportSummaryAvailable().then(setSummaryAvailable);
  }, []);

  // Any previously generated summary belonged to a different period or
  // location — never show stale AI text next to fresh numbers.
  useEffect(() => {
    setSummaryResult(null);
    setSummaryError(null);
  }, [locationTab, dateRange]);

  const allReviews = useMemo(() => {
    if (!reviewsByLocation) return [];
    const combined: Review[] = [];
    for (const id of VISIBLE_LOCATION_IDS) {
      const items = reviewsByLocation[id];
      if (items) combined.push(...businessReviewsFor(id, items));
    }
    return combined;
  }, [reviewsByLocation]);

  const scopedReviews = useMemo(
    () => allReviews.filter((r) => isWithinRange(dateFromReview(r), dateRange)),
    [allReviews, dateRange],
  );

  const tabReviews = useMemo(
    () =>
      locationTab === "all"
        ? scopedReviews
        : scopedReviews.filter((r) => r.location === locationTab),
    [scopedReviews, locationTab],
  );

  const perLocationStars = useMemo(
    () =>
      VISIBLE_LOCATION_IDS.map((id) => {
        const counts = starCounts(scopedReviews.filter((r) => r.location === id));
        return { id, name: LOCATION_NAME.get(id) ?? id, counts, total: totalFromCounts(counts) };
      }),
    [scopedReviews],
  );

  const totalCounts = useMemo(
    () =>
      perLocationStars.reduce(
        (acc, loc) => sumStarCounts(acc, loc.counts),
        { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      ),
    [perLocationStars],
  );

  const locationsToShow = locationTab === "all" ? VISIBLE_LOCATION_IDS : [locationTab];

  const removedForPeriod = useMemo(
    () =>
      (removed ?? []).filter(
        (r) =>
          (locationTab === "all" || r.location === locationTab) &&
          isWithinRange(new Date(r.detectedAt), dateRange),
      ),
    [removed, locationTab, dateRange],
  );

  const editsForPeriod = useMemo(
    () =>
      (edits ?? []).filter(
        (e) =>
          (locationTab === "all" || e.location === locationTab) &&
          isWithinRange(new Date(e.detectedAt), dateRange),
      ),
    [edits, locationTab, dateRange],
  );

  // Once the report is rendered: print only it, then clear it again.
  useEffect(() => {
    if (!report) return;
    document.body.classList.add("print-report");
    const done = () => {
      document.body.classList.remove("print-report");
      setReport(null);
    };
    window.addEventListener("afterprint", done, { once: true });
    const timer = window.setTimeout(() => window.print(), 50);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", done);
      document.body.classList.remove("print-report");
    };
  }, [report]);

  /** The joint report over all locations for the chosen period — the same
   * layout whichever location tab is open. */
  async function handleExportReport() {
    setReportNote(null);
    const locations = REPORT_LOCATION_ORDER.filter((id) => VISIBLE_LOCATION_IDS.includes(id)).map((id) => {
      const reviews = scopedReviews.filter((r) => r.location === id);
      return { id, name: LOCATION_TAB_LABEL[id], reviews, counts: starCounts(reviews) };
    });
    const removedInPeriod = (removed ?? []).filter((r) => isWithinRange(new Date(r.detectedAt), dateRange)).length;

    let texts: WeekReportData["texts"] = null;
    if (can("ai") && summaryAvailable) {
      setPreparingReport(true);
      const overviewTable = locations
        .map((l) => {
          const total = l.counts[1] + l.counts[2] + l.counts[3] + l.counts[4] + l.counts[5];
          return `${l.name}: 5★ ${l.counts[5]}, 4★ ${l.counts[4]}, 3★ ${l.counts[3]}, 2★ ${l.counts[2]}, 1★ ${l.counts[1]}, totaal ${total}`;
        })
        .join("\n");
      const result = await generateWeekReport({
        periodLabel: formatPeriod(dateRange),
        overviewTable,
        locations: locations.map((l) => ({
          id: l.id,
          name: l.name,
          // What the AI uses (as capped on the server): every negative review
          // (up to 60) and up to 40 positive ones with text, texts shortened.
          reviews: [
            ...l.reviews.filter((r) => r.rating <= 3).slice(0, 60),
            ...l.reviews.filter((r) => r.rating >= 4 && r.snippet.trim()).slice(0, 40),
          ].map((r) => ({ id: r.googleReviewId ?? r.id, rating: r.rating, text: r.snippet.slice(0, 700) })),
        })),
      });
      setPreparingReport(false);
      if (result.ok) texts = result.texts;
      else setReportNote(`AI-teksten konden niet worden gemaakt (${result.error}); het rapport is zonder die teksten gemaakt.`);
    }
    setReport({ range: dateRange, locations, texts, removedInPeriod, keywordCategories: (r) => keywordCategories(r.snippet) });
  }

  async function handleGenerateSummary() {
    if (locationTab === "all") return;
    setSummaryLoading(true);
    setSummaryError(null);
    const result = await generateReportSummary(
      LOCATION_TAB_LABEL[locationTab],
      formatRangeLabel(dateRange),
      tabReviews.map((r) => ({
        reviewer: r.reviewer,
        rating: r.rating,
        text: r.snippet,
        createTime: r.publishedAt ?? null,
      })),
    );
    setSummaryLoading(false);
    if (result.ok) {
      setSummaryResult(result.summary);
    } else {
      setSummaryError(result.error);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Rapportage</div>
          <div className={styles.subtitle}>
            Overzicht per periode — sterrenverdeling, kritieke thema&apos;s, verwijderingen en
            bewerkingen, in dezelfde vorm als de week-/maandrapportages.
          </div>
        </div>
        <div className={styles.headerRight}>
          <RefreshButton />
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
          <button
            type="button"
            className={exportStyles.button}
            data-print-hide
            onClick={handleExportReport}
            disabled={preparingReport || loading || !isLive}
            title="Het gezamenlijke rapport over alle locaties voor de gekozen periode"
          >
            {preparingReport ? "Rapport voorbereiden..." : "Exporteer naar PDF"}
          </button>
        </div>
      </div>
      {reportNote && (
        <div className={styles.cardFootnote} role="status" data-print-hide>
          {reportNote}
        </div>
      )}
      {report && <WeekReport data={report} />}

      <div className={styles.locationTabs} role="tablist" aria-label="Locatie">
        <button
          type="button"
          role="tab"
          aria-selected={locationTab === "all"}
          className={
            locationTab === "all"
              ? `${styles.locationTab} ${styles.locationTabActive}`
              : styles.locationTab
          }
          onClick={() => setLocationTab("all")}
        >
          Totaal
        </button>
        {VISIBLE_LOCATION_IDS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={locationTab === id}
            className={
              locationTab === id
                ? `${styles.locationTab} ${styles.locationTabActive}`
                : styles.locationTab
            }
            onClick={() => setLocationTab(id)}
          >
            {LOCATION_TAB_LABEL[id]}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingState />
      ) : !isLive ? (
        <div className={styles.empty}>
          Nog niet gekoppeld — er is geen backend-verbinding voor de reviewgeschiedenis die deze
          rapportage nodig heeft.
        </div>
      ) : (
        <>
          {locationTab === "all" && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Alle winkels in één oogopslag</div>
              <div className={styles.cardSubtitle}>
                {formatRangeLabel(dateRange)} · alleen de locaties die dit dashboard al volgt.
              </div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Winkel</th>
                    {STAR_COLUMNS.map((n) => (
                      <th key={n}>{n}★</th>
                    ))}
                    <th>Totaal</th>
                  </tr>
                </thead>
                <tbody>
                  {perLocationStars.map((loc) => (
                    <tr key={loc.id}>
                      <td>{loc.name}</td>
                      {STAR_COLUMNS.map((n) => (
                        <td key={n}>{loc.counts[n]}</td>
                      ))}
                      <td className={styles.tableTotal}>{loc.total}</td>
                    </tr>
                  ))}
                  <tr className={styles.tableTotalRow}>
                    <td>Totaal</td>
                    {STAR_COLUMNS.map((n) => (
                      <td key={n}>{totalCounts[n]}</td>
                    ))}
                    <td className={styles.tableTotal}>{totalFromCounts(totalCounts)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {locationsToShow.map((id) => {
            const locReviews = scopedReviews.filter((r) => r.location === id);
            const { rows, uniqueCriticalCount } = buildThemeStarBreakdown(locReviews);
            return (
              <div className={styles.card} key={id}>
                <div className={styles.cardTitle}>Negatieve reviews — {LOCATION_TAB_LABEL[id]}</div>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Onderwerp</th>
                      <th>1★</th>
                      <th>2★</th>
                      <th>3★</th>
                      <th>Totaal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.theme}>
                        <td>{row.theme}</td>
                        <td>{row.counts[1]}</td>
                        <td>{row.counts[2]}</td>
                        <td>{row.counts[3]}</td>
                        <td className={styles.tableTotal}>{row.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className={styles.cardFootnote}>
                  {uniqueCriticalCount === 0
                    ? "Geen reviews van 1 tot en met 3 sterren in deze periode."
                    : `${uniqueCriticalCount} unieke kritische review(s). Eén review kan meerdere thema's raken, dus de rijen hierboven kunnen optellen tot meer dan dit aantal.`}
                </div>
              </div>
            );
          })}

          <div className={styles.card}>
            <div className={styles.cardTitle}>Financiële indicatie (voorbeeldberekening)</div>
            <div className={styles.cardSubtitle}>
              Rekenregel: 5★ = +€{5}, 4★ = €0, 1-3★ = -€{10} per review. Nog geen vastgestelde
              regel — alleen bedoeld als indicatie.
            </div>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Locatie</th>
                  <th>5★ × €5</th>
                  <th>1-3★ × -€10</th>
                  <th>Netto</th>
                </tr>
              </thead>
              <tbody>
                {perLocationStars.map((loc) => {
                  const pot = computePot(loc.counts);
                  return (
                    <tr key={loc.id}>
                      <td>{loc.name}</td>
                      <td>{formatEur(pot.fiveStarEur)}</td>
                      <td>{formatEur(pot.lowStarEur)}</td>
                      <td className={styles.tableTotal}>{formatEur(pot.netEur)}</td>
                    </tr>
                  );
                })}
                {(() => {
                  const pot = computePot(totalCounts);
                  return (
                    <tr className={styles.tableTotalRow}>
                      <td>Totaal</td>
                      <td>{formatEur(pot.fiveStarEur)}</td>
                      <td>{formatEur(pot.lowStarEur)}</td>
                      <td className={styles.tableTotal}>{formatEur(pot.netEur)}</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Verwijderd &amp; bewerkt in deze periode</div>
            <div className={styles.cardSubtitle}>
              Alleen wat sinds het starten van deze detectie is gezien — geen historie van
              daarvoor (zie "Verwijderde reviews" op het dashboard).
            </div>
            {removedForPeriod.length === 0 && editsForPeriod.length === 0 ? (
              <div className={styles.cardFootnote}>
                Geen verwijderingen of bewerkingen gedetecteerd in deze periode.
              </div>
            ) : (
              <div className={styles.changeList}>
                {removedForPeriod.map((r) => (
                  <div className={styles.changeRow} key={r.id}>
                    <span className={styles.changeBadgeRemoved}>Verwijderd</span>
                    <span className={styles.changeReviewer}>{r.reviewer}</span>
                    <span className={styles.changeDetail}>
                      {r.rating}★ · {LOCATION_TAB_LABEL[r.location]}
                    </span>
                    <span className={styles.changeTime}>
                      {r.createTime && <>geplaatst {formatReviewTimestamp(r.createTime)} · </>}
                      opgemerkt {formatReviewTimestamp(r.detectedAt)}
                    </span>
                  </div>
                ))}
                {editsForPeriod.map((e) => (
                  <details className={styles.changeRow} key={e.id}>
                    <summary className={styles.changeSummary}>
                      <span className={styles.changeBadgeEdited}>Bewerkt</span>
                      <span className={styles.changeReviewer}>{e.reviewer}</span>
                      <span className={styles.changeDetail}>
                        {describeEditChange(e)} · {LOCATION_TAB_LABEL[e.location]}
                      </span>
                      <span className={styles.changeTime}>
                        {formatReviewTimestamp(e.detectedAt)}
                      </span>
                    </summary>
                    <div className={styles.changeTexts}>
                      <div>
                        <div className={styles.changeTextLabel}>Eerst ({e.previousRating}★)</div>
                        <ReviewText text={e.previousText} className={styles.changeText} />
                      </div>
                      <div>
                        <div className={styles.changeTextLabel}>Nu ({e.newRating}★)</div>
                        <ReviewText text={e.newText} className={styles.changeText} />
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </div>

          {/* Accounts without the "ai" permission don't see this card at all —
              "binnenkort beschikbaar" would wrongly suggest it's coming for them. */}
          {can("ai") && (
            <div className={styles.card} data-print-hide={!summaryAvailable || undefined}>
              <div className={styles.cardTitle}>
                AI-samenvatting
                {!summaryAvailable && (
                  <span className={styles.comingSoonBadge}>Binnenkort beschikbaar</span>
                )}
              </div>
              {!summaryAvailable ? (
                <div className={styles.cardFootnote} data-print-hide>
                  Deze functie werkt nog niet — we zijn hier nog aan het werken.
                </div>
              ) : locationTab === "all" ? (
                <div className={styles.cardFootnote} data-print-hide>
                  Kies hierboven een specifieke locatie om een samenvatting te genereren — net als
                  in de weekrapportage is dit per locatie geschreven.
                </div>
              ) : summaryResult ? (
                <div className={styles.summaryBlocks}>
                  {summaryResult.compliments && (
                    <div className={styles.summaryBlock}>
                      <div className={styles.summaryLabel}>Complimenten</div>
                      <div className={styles.summaryText}>{summaryResult.compliments}</div>
                    </div>
                  )}
                  {summaryResult.concerns && (
                    <div className={styles.summaryBlock}>
                      <div className={styles.summaryLabel}>Aandachtspunten</div>
                      <div className={styles.summaryText}>{summaryResult.concerns}</div>
                    </div>
                  )}
                  {summaryResult.closing && (
                    <div className={styles.summaryBlock}>
                      <div className={styles.summaryLabel}>Afsluiting</div>
                      <div className={styles.summaryText}>{summaryResult.closing}</div>
                    </div>
                  )}
                  <button
                    type="button"
                    className={styles.summaryButton}
                    data-print-hide
                    onClick={handleGenerateSummary}
                    disabled={summaryLoading}
                  >
                    Opnieuw genereren
                  </button>
                </div>
              ) : (
                <div data-print-hide>
                  {summaryError && <div className={styles.summaryError}>{summaryError}</div>}
                  <button
                    type="button"
                    className={styles.summaryButton}
                    onClick={handleGenerateSummary}
                    disabled={summaryLoading}
                  >
                    {summaryLoading
                      ? "Samenvatting genereren..."
                      : `Genereer samenvatting (${formatDutchInt(tabReviews.length)} reviews)`}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
