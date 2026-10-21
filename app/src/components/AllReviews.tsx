import { useEffect, useMemo, useState } from "react";
import { LOCATION_TAB_LABEL, VISIBLE_LOCATION_IDS } from "../config";
import { LOCATIONS } from "../data/mockData";
import type { LiveBusinessReview, RemovedReview, ReviewEdit } from "../lib/api";
import { isWithinRange, rangeForPreset, type DateRange } from "../lib/dateRange";
import { daysAgoLabel, formatReviewTimestamp } from "../lib/format";
import { businessReviewsFor, dateFromReview, reviewsFromRemoved } from "../lib/reviews";
import { originalVersionFor } from "../lib/reviewHistory";
import { detectReviewPatterns, reviewMatchesTheme } from "../lib/reviewPatterns";
import { sortReviews, SORT_OPTIONS, type SortOption } from "../lib/reviewSort";
import type { LocationId, Review } from "../types";
import { StarRating } from "./badges";
import { DateRangeSelector } from "./DateRangeSelector";
import { ExportPdfButton } from "./ExportPdfButton";
import { FilterDropdown, type FilterOption } from "./FilterDropdown";
import { LoadingState } from "./LoadingState";
import { ReplyForm } from "./ReplyForm";
import styles from "./AllReviews.module.css";
import { ReviewText } from "./ReviewText";

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

export type StatusFilter = "all" | "open" | "responded" | "removed";

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
  removed: RemovedReview[] | null;
}

export function AllReviews({
  reviewsByLocation,
  isLive,
  loading,
  filterRequest,
  edits,
  removed,
}: AllReviewsProps) {
  const [shown, setShown] = useState(PAGE_SIZE);
  const [locationTab, setLocationTab] = useState<LocationId | "all">("all");
  // Defaults to the full history — "Alle reviews" is explicitly meant to
  // be the complete list, not scoped to a week by default like the
  // dashboard — but can be narrowed down from here too.
  const [dateRange, setDateRange] = useState<DateRange>(() => rangeForPreset("all-time"));
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
    const byLocation =
      locationTab === "all" ? allReviews : allReviews.filter((r) => r.location === locationTab);
    return byLocation.filter((r) => isWithinRange(dateFromReview(r), dateRange));
  }, [allReviews, locationTab, dateRange]);

  const patterns = useMemo(() => detectReviewPatterns(scopedReviews), [scopedReviews]);

  // Reviews Google no longer serves at all — kept out of the normal list
  // (and its "Alle"/"Onbeantwoord"/"Beantwoord" counts) and only shown
  // once "Verwijderd" is explicitly selected, same split as Localo's
  // status filter. Scoped by location only, not by date range — the
  // meaningful date here (when it was detected gone) isn't what the
  // period selector filters on.
  const removedScoped = useMemo(() => {
    const asReviews = reviewsFromRemoved(removed ?? []);
    return locationTab === "all"
      ? asReviews
      : asReviews.filter((r) => r.location === locationTab);
  }, [removed, locationTab]);

  const reviews = useMemo(() => {
    const base = statusFilter === "removed" ? removedScoped : scopedReviews;
    const filtered = base.filter((r) => {
      if (statusFilter === "open" && isResponded(r)) return false;
      if (statusFilter === "responded" && !isResponded(r)) return false;
      if (ratingFilter !== "all" && r.rating !== ratingFilter) return false;
      if (activeTheme && !reviewMatchesTheme(r, activeTheme)) return false;
      return true;
    });
    return sortReviews(filtered, sortBy);
  }, [scopedReviews, removedScoped, statusFilter, ratingFilter, activeTheme, sortBy, repliedText]);

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
      { value: "removed", label: "Verwijderd", count: removedScoped.length },
    ],
    [scopedReviews, removedScoped, repliedText],
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

  const filtersActive =
    statusFilter !== "all" || ratingFilter !== "all" || activeTheme !== null;

  // Whichever pool "reviews" was built from — live reviews normally, the
  // detected-removed pool once that status is selected — used for the
  // header count and the "nothing here" empty states below.
  const activeBase = statusFilter === "removed" ? removedScoped : scopedReviews;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Alle reviews</div>
          <div className={styles.subtitle}>
            {locationTab === "all"
              ? "Volledige lijst over alle gekoppelde locaties, te filteren op periode."
              : `Volledige lijst voor ${LOCATION_TAB_LABEL[locationTab]}, te filteren op periode.`}
          </div>
        </div>
        <div className={styles.headerRight}>
          {activeBase.length > 0 && (
            <div className={styles.count}>
              {reviews.length === activeBase.length
                ? `${activeBase.length} totaal`
                : `${reviews.length} van ${activeBase.length}`}
            </div>
          )}
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
          <ExportPdfButton />
        </div>
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

      {allReviews.length > 0 && (
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
              data-print-hide
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
      ) : activeBase.length === 0 ? (
        <div className={styles.empty}>
          {statusFilter === "removed"
            ? "Nog geen verwijderingen gedetecteerd voor deze locatie."
            : "Geen reviews voor deze locatie."}
        </div>
      ) : reviews.length === 0 ? (
        <div className={styles.empty}>Geen reviews voor deze filtercombinatie.</div>
      ) : (
        <>
          <div className={styles.list}>
            {reviews.map((review, index) => {
              const original = review.googleReviewId
                ? originalVersionFor(review.googleReviewId, edits)
                : undefined;
              // Reviews beyond the current page are kept in the DOM (not
              // sliced out) so a PDF export can reveal all of them via
              // print CSS — "load meer" is just a screen-space concern,
              // not a real filter the export should respect.
              const beyondPage = index >= shown;
              return (
                <div
                  key={review.id}
                  className={beyondPage ? `${styles.item} ${styles.itemBeyondPage}` : styles.item}
                >
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
                    <ReviewText text={review.snippet} className={styles.snippet} />
                    {original && (
                      <div className={styles.editNotice}>
                        <div className={styles.editLabel}>
                          Bewerkt · oorspronkelijk {original.rating}★
                        </div>
                        <ReviewText text={original.text} className={styles.editText} />
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
                        reviewer={review.reviewer}
                        rating={review.rating}
                        reviewText={review.snippet}
                        onSent={(text) =>
                          setRepliedText((prev) => new Map(prev).set(review.id, text))
                        }
                      />
                    )}
                  </div>
                  <div
                    className={
                      review.removedAt ? `${styles.aside} ${styles.asideRemoved}` : styles.aside
                    }
                  >
                    {review.removedAt ? (
                      <span className={styles.statusRemoved}>Verwijderd</span>
                    ) : (
                      <span
                        className={
                          isResponded(review) ? styles.statusResponded : styles.statusOpen
                        }
                      >
                        {isResponded(review) ? "Beantwoord" : "Onbeantwoord"}
                      </span>
                    )}
                    <span className={styles.time}>
                      {review.removedAt ? (
                        <>
                          {review.publishedAt && (
                            <span className={styles.timestamp}>
                              Geplaatst {formatReviewTimestamp(review.publishedAt)}
                            </span>
                          )}
                          <span className={styles.timestamp}>
                            Opgemerkt {formatReviewTimestamp(review.removedAt)}
                          </span>
                        </>
                      ) : (
                        <>
                          {daysAgoLabel(review.daysAgo)}
                          {review.publishedAt && (
                            <span className={styles.timestamp}>
                              {formatReviewTimestamp(review.publishedAt)}
                            </span>
                          )}
                        </>
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
              data-print-hide
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
