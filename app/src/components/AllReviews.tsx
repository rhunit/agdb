import { useEffect, useMemo, useState } from "react";
import { LOCATION_TAB_LABEL, VISIBLE_LOCATION_IDS } from "../config";
import { LOCATIONS } from "../data/mockData";
import type { LiveBusinessReview, ReviewEdit } from "../lib/api";
import { daysAgoLabel, formatReviewTimestamp } from "../lib/format";
import { businessReviewsFor } from "../lib/reviews";
import { originalVersionFor } from "../lib/reviewHistory";
import { detectReviewPatterns, reviewMatchesTheme } from "../lib/reviewPatterns";
import { sortReviews, SORT_OPTIONS, type SortOption } from "../lib/reviewSort";
import type { LocationId, Review } from "../types";
import { StarRating } from "./badges";
import { FilterDropdown, type FilterOption } from "./FilterDropdown";
import { LoadingState } from "./LoadingState";
import { ReplyForm } from "./ReplyForm";
import { ReviewPatterns } from "./ReviewPatterns";
import styles from "./AllReviews.module.css";

const LOCATION_NAME = new Map(LOCATIONS.map((l) => [l.id, l.name]));
const PAGE_SIZE = 25;
const RATING_OPTIONS: FilterOption[] = [
  { value: "all", label: "Alle sterren" },
  { value: "5", label: "5 sterren" },
  { value: "4", label: "4 sterren" },
  { value: "3", label: "3 sterren" },
  { value: "2", label: "2 sterren" },
  { value: "1", label: "1 ster" },
];

export type StatusFilter = "all" | "open" | "responded";

/** A request to jump straight into a specific filter combination (e.g.
 * from the status strip's "view the critical reviews" link). Passing a
 * new object — even with the same values — re-applies it, since the
 * person may want to re-trigger the jump after changing filters by hand. */
export interface AllReviewsFilterRequest {
  status: StatusFilter;
  rating: number | "all";
}

interface AllReviewsProps {
  reviewsByLocation: Partial<Record<LocationId, LiveBusinessReview[]>> | null;
  isLive: boolean;
  loading: boolean;
  filterRequest?: AllReviewsFilterRequest | null;
  edits: ReviewEdit[] | null;
}

export function AllReviews({
  reviewsByLocation,
  isLive,
  loading,
  filterRequest,
  edits,
}: AllReviewsProps) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const [locationTab, setLocationTab] = useState<LocationId | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [activeTheme, setActiveTheme] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  // Reviews replied to in this session, ahead of the next full refetch —
  // lets the status (and the reply text itself) show immediately after a
  // send succeeds, keyed by review id -> the text that was sent.
  const [repliedText, setRepliedText] = useState<Map<string, string>>(new Map());

  function isResponded(review: Review): boolean {
    return review.responded || repliedText.has(review.id);
  }

  function replyTextFor(review: Review): string | undefined {
    return repliedText.get(review.id) ?? review.replyText;
  }

  useEffect(() => {
    if (!filterRequest) return;
    setLocationTab("all");
    setStatusFilter(filterRequest.status);
    setRatingFilter(filterRequest.rating);
    setActiveTheme(null);
    setShown(PAGE_SIZE);
  }, [filterRequest]);

  const allReviews = useMemo(() => {
    if (!reviewsByLocation) return [];
    const combined: Review[] = [];
    for (const id of VISIBLE_LOCATION_IDS) {
      const items = reviewsByLocation[id];
      if (items) combined.push(...businessReviewsFor(id, items));
    }
    return combined.sort((a, b) => a.daysAgo - b.daysAgo);
  }, [reviewsByLocation]);

  const scopedReviews = useMemo(() => {
    if (locationTab === "all") return allReviews;
    return allReviews.filter((r) => r.location === locationTab);
  }, [allReviews, locationTab]);

  const patterns = useMemo(() => detectReviewPatterns(scopedReviews), [scopedReviews]);

  const reviews = useMemo(() => {
    const filtered = scopedReviews.filter((r) => {
      if (statusFilter === "open" && isResponded(r)) return false;
      if (statusFilter === "responded" && !isResponded(r)) return false;
      if (ratingFilter !== "all" && r.rating !== ratingFilter) return false;
      if (activeTheme && !reviewMatchesTheme(r, activeTheme)) return false;
      return true;
    });
    return sortReviews(filtered, sortBy);
  }, [scopedReviews, statusFilter, ratingFilter, activeTheme, sortBy, repliedText]);

  const statusOptions: FilterOption[] = useMemo(
    () => [
      { value: "all", label: "Alle", count: scopedReviews.length },
      {
        value: "open",
        label: "Onbeantwoord",
        count: scopedReviews.filter((r) => !isResponded(r)).length,
      },
      {
        value: "responded",
        label: "Beantwoord",
        count: scopedReviews.filter((r) => isResponded(r)).length,
      },
    ],
    [scopedReviews, repliedText],
  );

  const themeOptions: FilterOption[] = useMemo(
    () => [
      { value: "all", label: "Alle thema's" },
      ...patterns.map((p) => ({ value: p.label, label: p.label, count: p.count })),
    ],
    [patterns],
  );

  function selectLocationTab(next: LocationId | "all") {
    setLocationTab(next);
    setShown(PAGE_SIZE);
  }

  function updateStatusFilter(next: string) {
    setStatusFilter(next as StatusFilter);
    setShown(PAGE_SIZE);
  }

  function updateRatingFilter(next: string) {
    setRatingFilter(next === "all" ? "all" : Number(next));
    setShown(PAGE_SIZE);
  }

  function updateThemeFilter(next: string) {
    setActiveTheme(next === "all" ? null : next);
    setShown(PAGE_SIZE);
  }

  function selectTheme(label: string) {
    setActiveTheme((prev) => (prev === label ? null : label));
    setShown(PAGE_SIZE);
  }

  const filtersActive =
    statusFilter !== "all" || ratingFilter !== "all" || activeTheme !== null;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Alle reviews</div>
          <div className={styles.subtitle}>
            {locationTab === "all"
              ? "Volledige, ongefilterde lijst over alle gekoppelde locaties — niet beperkt tot deze week."
              : `Volledige, ongefilterde lijst voor ${LOCATION_TAB_LABEL[locationTab]} — niet beperkt tot deze week.`}
          </div>
        </div>
        {scopedReviews.length > 0 && (
          <div className={styles.count}>
            {reviews.length === scopedReviews.length
              ? `${scopedReviews.length} totaal`
              : `${reviews.length} van ${scopedReviews.length}`}
          </div>
        )}
      </div>

      {allReviews.length > 0 && (
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
            onClick={() => selectLocationTab("all")}
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
              onClick={() => selectLocationTab(id)}
            >
              {LOCATION_TAB_LABEL[id]}
            </button>
          ))}
        </div>
      )}

      {!loading && scopedReviews.length > 0 && (
        <ReviewPatterns
          reviews={scopedReviews}
          activeTheme={activeTheme}
          onSelectTheme={selectTheme}
        />
      )}

      {scopedReviews.length > 0 && (
        <div className={styles.filters}>
          <FilterDropdown
            label="Status"
            options={statusOptions}
            value={statusFilter}
            onChange={updateStatusFilter}
          />
          <FilterDropdown
            label="Sterren"
            options={RATING_OPTIONS}
            value={String(ratingFilter)}
            onChange={updateRatingFilter}
          />
          <FilterDropdown
            label="Thema"
            options={themeOptions}
            value={activeTheme ?? "all"}
            onChange={updateThemeFilter}
          />

          <div className={styles.filterSpacer} />

          <FilterDropdown
            label="Sorteren"
            options={SORT_OPTIONS}
            value={sortBy}
            onChange={(next) => setSortBy(next as SortOption)}
          />

          {filtersActive && (
            <button
              type="button"
              className={styles.filterReset}
              onClick={() => {
                setStatusFilter("all");
                setRatingFilter("all");
                setActiveTheme(null);
                setShown(PAGE_SIZE);
              }}
            >
              Filters wissen
            </button>
          )}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : !isLive ? (
        <div className={styles.empty}>
          Nog niet gekoppeld — er is geen backend-verbinding voor de volledige
          reviewgeschiedenis.
        </div>
      ) : allReviews.length === 0 ? (
        <div className={styles.empty}>Geen reviews gevonden voor de gekoppelde locaties.</div>
      ) : scopedReviews.length === 0 ? (
        <div className={styles.empty}>Geen reviews voor deze locatie.</div>
      ) : reviews.length === 0 ? (
        <div className={styles.empty}>Geen reviews voor deze filtercombinatie.</div>
      ) : (
        <>
          <div className={styles.list}>
            {reviews.slice(0, shown).map((review) => {
              const original = review.googleReviewId
                ? originalVersionFor(review.googleReviewId, edits)
                : undefined;
              return (
                <div key={review.id} className={styles.item}>
                  <div className={styles.initials}>{review.initials}</div>
                  <div className={styles.body}>
                    <div className={styles.meta}>
                      <span className={styles.reviewer}>{review.reviewer}</span>
                      <StarRating rating={review.rating} />
                      {locationTab === "all" && (
                        <span className={styles.locationName}>
                          · {LOCATION_NAME.get(review.location)}
                        </span>
                      )}
                    </div>
                    <div className={styles.snippet}>&ldquo;{review.snippet}&rdquo;</div>
                    {original && (
                      <div className={styles.editNotice}>
                        <div className={styles.editLabel}>
                          Bewerkt · oorspronkelijk {original.rating}★
                        </div>
                        <div className={styles.editText}>&ldquo;{original.text}&rdquo;</div>
                      </div>
                    )}
                    {isResponded(review) && replyTextFor(review) && (
                      <div className={styles.reply}>
                        <div className={styles.replyLabel}>Jullie antwoord</div>
                        <div className={styles.replyText}>{replyTextFor(review)}</div>
                      </div>
                    )}
                    {!isResponded(review) && review.googleReviewId && (
                      <ReplyForm
                        location={review.location}
                        googleReviewId={review.googleReviewId}
                        onSent={(text) =>
                          setRepliedText((prev) => new Map(prev).set(review.id, text))
                        }
                      />
                    )}
                  </div>
                  <div className={styles.aside}>
                    <span
                      className={
                        isResponded(review) ? styles.statusResponded : styles.statusOpen
                      }
                    >
                      {isResponded(review) ? "Beantwoord" : "Onbeantwoord"}
                    </span>
                    <span className={styles.time}>
                      {daysAgoLabel(review.daysAgo)}
                      {review.publishedAt && (
                        <span className={styles.timestamp}>
                          {formatReviewTimestamp(review.publishedAt)}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          {shown < reviews.length && (
            <button
              type="button"
              className={styles.loadMore}
              onClick={() => setShown((n) => n + PAGE_SIZE)}
            >
              Toon meer ({reviews.length - shown} resterend)
            </button>
          )}
        </>
      )}
    </div>
  );
}
