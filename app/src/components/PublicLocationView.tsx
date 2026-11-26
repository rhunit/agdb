import type { LivePlaceSummary } from "../lib/api";
import { formatReviewTimestamp } from "../lib/format";
import type { LocationId, ReviewGrowthWeek } from "../types";
import { StarRating } from "./badges";
import { LoadingState } from "./LoadingState";
import { ReviewText } from "./ReviewText";
import styles from "./PublicLocationView.module.css";

interface PublicLocationViewProps {
  id: LocationId;
  name: string;
  summary: LivePlaceSummary | undefined;
  growth: ReviewGrowthWeek[] | null;
  loading: boolean;
}

/** A location the dashboard has no Business Profile access to (Boerejongens
 * West): only what Google Maps shows publicly, with a clear notice of what
 * that means and what isn't possible. */
export function PublicLocationView({ id, name, summary, growth, loading }: PublicLocationViewProps) {
  const weeks = (growth ?? []).slice(-8).reverse();
  const thisWeek = weeks[0]; // newest measured week

  return (
    <div className={styles.wrap}>
      <div className={styles.notice} role="status">
        <div className={styles.noticeIcon} aria-hidden="true">
          *
        </div>
        <div>
          <div className={styles.noticeTitle}>Volledige gegevens van {name} zijn nog niet beschikbaar</div>
          <p className={styles.noticeText}>
            Het dashboard heeft (nog) geen toegang tot het Google-bedrijfsprofiel van {name}. Hieronder staan
            alleen openbare gegevens uit Google Maps.
          </p>
          <div className={styles.columns}>
            <div>
              <div className={styles.listTitle}>Wel beschikbaar</div>
              <ul className={styles.list}>
                <li>Google-score en totaal aantal reviews</li>
                <li>Aantal nieuwe reviews per week (sinds het dashboard dit bijhoudt)</li>
                <li>Maximaal 5 reviews, door Google gekozen (niet per se de nieuwste)</li>
              </ul>
            </div>
            <div>
              <div className={styles.listTitle}>Niet mogelijk</div>
              <ul className={styles.list}>
                <li>Reageren op reviews (ook geen AI-opzet of bulk beantwoorden)</li>
                <li>Alle reviews bekijken en doorzoeken</li>
                <li>Verdeling per sterrental en de review bonus</li>
                <li>Opnemen in Rapportage, de PDF-export en het weekrapport per e-mail</li>
                <li>Verwijderde en bewerkte reviews signaleren</li>
              </ul>
            </div>
          </div>
          <p className={styles.noticeText}>
            Oplossing: de eigenaar van het profiel voegt het Google-account van het dashboard toe als beheerder
            (Google Bedrijfsprofiel → Profielinstellingen → Personen en toegang). Dan werkt alles zoals bij de
            andere locaties.
          </p>
        </div>
      </div>

      {loading ? (
        <LoadingState />
      ) : !summary ? (
        <div className={styles.card}>De openbare gegevens van {name} konden niet worden opgehaald.</div>
      ) : (
        <>
          <div className={styles.stats}>
            <div className={styles.card}>
              <div className={styles.statLabel}>Google-score</div>
              <div className={styles.statValue}>
                {summary.rating !== null ? summary.rating.toFixed(1).replace(".", ",") : "—"}
              </div>
              {summary.rating !== null && <StarRating rating={Math.round(summary.rating)} />}
            </div>
            <div className={styles.card}>
              <div className={styles.statLabel}>Totaal aantal reviews</div>
              <div className={styles.statValue}>{summary.userRatingCount.toLocaleString("nl-NL")}</div>
            </div>
            <div className={styles.card}>
              <div className={styles.statLabel}>Nieuwe reviews, laatst gemeten week</div>
              <div className={styles.statValue}>{thisWeek ? thisWeek[id] : "—"}</div>
              <div className={styles.statHint}>
                {thisWeek ? `Week ${thisWeek.week.replace(/^W/, "")}. ` : ""}Uit de stijging van het totaal; de sterren
                zijn niet bekend.
              </div>
            </div>
          </div>

          {weeks.length > 0 && (
            <div className={styles.card}>
              <div className={styles.cardTitle}>Nieuwe reviews per week</div>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Week</th>
                    <th>Nieuwe reviews</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((w) => (
                    <tr key={w.week}>
                      <td>{w.week}</td>
                      <td>{w[id]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.card}>
            <div className={styles.cardTitle}>Reviews die Google toont</div>
            <div className={styles.cardHint}>
              Maximaal 5, door Google gekozen als "meest relevant" — niet per se de nieuwste. Reageren kan hier niet.
            </div>
            {summary.reviews.length === 0 ? (
              <div className={styles.cardHint}>Google geeft op dit moment geen reviews terug.</div>
            ) : (
              <div className={styles.reviews}>
                {summary.reviews.map((r, i) => (
                  <div className={styles.review} key={`${r.authorName}-${i}`}>
                    <div className={styles.reviewMeta}>
                      <span className={styles.reviewer}>{r.authorName}</span>
                      <StarRating rating={r.rating} />
                      <span className={styles.reviewTime}>
                        {r.publishTime ? formatReviewTimestamp(r.publishTime) : r.relativeTime}
                      </span>
                    </div>
                    {r.text ? (
                      <ReviewText text={r.text} className={styles.reviewText} />
                    ) : (
                      <div className={styles.cardHint}>Geen tekst, alleen sterren.</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
