import { useEffect, useRef, useState } from "react";
import { LOCATION_TAB_LABEL } from "../config";
import { generateReplyDraft, submitReviewReply } from "../lib/api";
import { formatReviewTimestamp } from "../lib/format";
import { addReplyLogEntry } from "../lib/replyLog";
import type { Review } from "../types";
import { StarRating } from "./badges";
import { ReviewText } from "./ReviewText";
import styles from "./BulkReplyDialog.module.css";

// "Bulk beantwoorden": AI drafts for a hand-picked set of unanswered
// reviews, read and edited here, then posted one by one after an explicit
// confirm. Posting goes through the normal reply endpoint with
// onlyIfUnanswered, so a review answered elsewhere in the meantime is
// skipped rather than overwritten.

/** Drafts written at the same time — quicker than one by one, without
 * flooding OpenAI. */
const DRAFT_CONCURRENCY = 3;
/** Pause between two posts, so Google sees a person-paced run rather than
 * a burst. */
export const POST_PAUSE_MS = 3000;

type ItemStatus =
  | "drafting"
  | "ready"
  | "draftFailed"
  | "posting"
  | "posted"
  | "skipped"
  | "failed";

interface Item {
  review: Review;
  text: string;
  include: boolean;
  status: ItemStatus;
  error?: string;
}

type Phase = "review" | "confirming" | "posting" | "done";

interface BulkReplyDialogProps {
  reviews: Review[];
  /** A review now has a reply on Google: one we posted, or (when skipped)
   * one someone else posted in the meantime. */
  onReplied: (review: Review, text: string) => void;
  onClose: () => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function BulkReplyDialog({ reviews, onReplied, onClose }: BulkReplyDialogProps) {
  const [items, setItems] = useState<Item[]>(() =>
    reviews.map((review) => ({ review, text: "", include: true, status: "drafting" })),
  );
  const [phase, setPhase] = useState<Phase>("review");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const stopRequested = useRef(false);
  const closed = useRef(false);

  function update(id: string, patch: Partial<Item>) {
    if (closed.current) return;
    setItems((prev) => prev.map((it) => (it.review.id === id ? { ...it, ...patch } : it)));
  }

  async function draft(review: Review) {
    update(review.id, { status: "drafting", error: undefined });
    const result = await generateReplyDraft({
      location: review.location,
      reviewer: review.reviewer,
      rating: review.rating,
      text: review.snippet,
    });
    if (result.ok) update(review.id, { status: "ready", text: result.draft });
    else update(review.id, { status: "draftFailed", error: result.error });
  }

  // All drafts on open, a few at a time.
  useEffect(() => {
    closed.current = false;
    const queue = [...reviews];
    const worker = async () => {
      for (let next = queue.shift(); next && !closed.current; next = queue.shift()) {
        await draft(next);
      }
    };
    void Promise.all(Array.from({ length: DRAFT_CONCURRENCY }, worker));
    return () => {
      closed.current = true;
    };
    // Runs once for the reviews the dialog was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drafting = items.some((it) => it.status === "drafting");
  const toPost = items.filter((it) => it.include && it.status === "ready" && it.text.trim());
  const counts = {
    posted: items.filter((it) => it.status === "posted").length,
    skipped: items.filter((it) => it.status === "skipped").length,
    failed: items.filter((it) => it.status === "failed").length,
  };

  async function postAll() {
    const batch = toPost;
    stopRequested.current = false;
    setPhase("posting");
    setProgress({ done: 0, total: batch.length });
    for (let i = 0; i < batch.length; i++) {
      if (stopRequested.current || closed.current) break;
      if (i > 0) await sleep(POST_PAUSE_MS);
      if (stopRequested.current || closed.current) break;
      const { review } = batch[i];
      const text = batch[i].text.trim();
      update(review.id, { status: "posting", error: undefined });
      const result = await submitReviewReply(review.location, review.googleReviewId!, text, {
        bulk: true,
        onlyIfUnanswered: true,
      });
      if (result.ok) {
        if (result.logged) addReplyLogEntry(result.logged);
        update(review.id, { status: "posted", text });
        onReplied(review, text);
      } else if (result.alreadyReplied !== undefined) {
        update(review.id, { status: "skipped", error: result.error });
        onReplied(review, result.alreadyReplied);
      } else {
        update(review.id, { status: "failed", error: result.error });
      }
      setProgress({ done: i + 1, total: batch.length });
    }
    if (!closed.current) setPhase("done");
  }

  function retryFailed() {
    setItems((prev) =>
      prev.map((it) => (it.status === "failed" ? { ...it, status: "ready", include: true } : it)),
    );
    setPhase("review");
  }

  function requestClose() {
    if (phase === "posting") return;
    const unsent = items.some(
      (it) => it.text.trim() && (it.status === "ready" || it.status === "failed"),
    );
    if (
      unsent &&
      !window.confirm("Venster sluiten? De concepten die nog niet geplaatst zijn gaan verloren.")
    ) {
      return;
    }
    closed.current = true;
    onClose();
  }

  // Escape closes, like any dialog (not while posting).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const editable = phase === "review";

  return (
    <div className={styles.overlay} data-print-hide>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-reply-title"
      >
        <div className={styles.header}>
          <div>
            <div className={styles.title} id="bulk-reply-title">
              Bulk beantwoorden
            </div>
            <div className={styles.subtitle}>
              {drafting
                ? `Concepten schrijven… ${items.filter((it) => it.status !== "drafting").length} van ${items.length} klaar`
                : "Lees elk concept na, pas het aan waar nodig en vink uit wat je niet wilt plaatsen."}
            </div>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={requestClose}
            disabled={phase === "posting"}
            aria-label="Sluiten"
          >
            ×
          </button>
        </div>

        <div className={styles.list}>
          {items.map((it) => (
            <div
              key={it.review.id}
              className={it.include || !editable ? styles.item : `${styles.item} ${styles.itemOff}`}
            >
              <div className={styles.review}>
                <div className={styles.meta}>
                  <span className={styles.reviewer}>{it.review.reviewer}</span>
                  <StarRating rating={it.review.rating} />
                </div>
                <div className={styles.where}>
                  {LOCATION_TAB_LABEL[it.review.location]}
                  {it.review.publishedAt && ` · ${formatReviewTimestamp(it.review.publishedAt)}`}
                </div>
                {it.review.snippet ? (
                  <ReviewText text={it.review.snippet} className={styles.text} />
                ) : (
                  <div className={styles.noText}>Geen tekst, alleen sterren.</div>
                )}
              </div>

              <div className={styles.reply}>
                {it.status === "drafting" ? (
                  <div className={styles.placeholder}>Concept schrijven…</div>
                ) : it.status === "draftFailed" ? (
                  <div className={styles.placeholder}>
                    <span className={styles.error}>{it.error}</span>
                  </div>
                ) : (
                  <textarea
                    className={styles.textarea}
                    value={it.text}
                    onChange={(e) => update(it.review.id, { text: e.target.value })}
                    rows={6}
                    disabled={!editable || it.status !== "ready"}
                    aria-label={`Antwoord aan ${it.review.reviewer}`}
                  />
                )}
                <div className={styles.itemActions}>
                  {it.status === "posted" ? (
                    <span className={styles.posted}>✓ Geplaatst</span>
                  ) : it.status === "posting" ? (
                    <span className={styles.muted}>Plaatsen…</span>
                  ) : it.status === "skipped" ? (
                    <span className={styles.skipped}>{it.error}</span>
                  ) : (
                    <>
                      {it.status === "failed" && <span className={styles.error}>{it.error}</span>}
                      <label className={styles.include}>
                        <input
                          type="checkbox"
                          checked={it.include}
                          disabled={!editable || it.status === "drafting"}
                          onChange={(e) => update(it.review.id, { include: e.target.checked })}
                        />
                        Plaatsen
                      </label>
                      <button
                        type="button"
                        className={styles.redraft}
                        disabled={!editable || it.status === "drafting"}
                        onClick={() => {
                          if (
                            it.text.trim() &&
                            !window.confirm("Dit concept vervangen door een nieuw concept?")
                          ) {
                            return;
                          }
                          void draft(it.review);
                        }}
                      >
                        {it.status === "draftFailed" ? "Opnieuw proberen" : "✨ Nieuw concept"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.footer}>
          {phase === "confirming" ? (
            <>
              <span className={styles.confirmText}>
                Weet je zeker dat je {toPost.length} review{toPost.length === 1 ? "" : "s"} wilt
                beantwoorden? De reacties worden direct openbaar geplaatst op Google.
              </span>
              <div className={styles.actions}>
                <button type="button" className={styles.secondary} onClick={() => setPhase("review")}>
                  Terug
                </button>
                <button type="button" className={styles.primary} onClick={postAll}>
                  Ja, {toPost.length} plaatsen
                </button>
              </div>
            </>
          ) : phase === "posting" ? (
            <>
              <div className={styles.progressWrap}>
                <span>
                  Plaatsen… {progress.done} van {progress.total}
                </span>
                <div className={styles.progress}>
                  <div
                    className={styles.progressBar}
                    style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
                  />
                </div>
              </div>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  stopRequested.current = true;
                }}
              >
                Stoppen
              </button>
            </>
          ) : phase === "done" ? (
            <>
              <span className={styles.summary}>
                {counts.posted} geplaatst
                {counts.skipped > 0 && ` · ${counts.skipped} overgeslagen (al beantwoord)`}
                {counts.failed > 0 && ` · ${counts.failed} mislukt`}
              </span>
              <div className={styles.actions}>
                {(counts.failed > 0 || items.some((it) => it.status === "ready")) && (
                  <button type="button" className={styles.secondary} onClick={retryFailed}>
                    {counts.failed > 0 ? "Mislukte opnieuw proberen" : "Terug naar concepten"}
                  </button>
                )}
                <button type="button" className={styles.primary} onClick={requestClose}>
                  Sluiten
                </button>
              </div>
            </>
          ) : (
            <>
              <span className={styles.summary}>
                {toPost.length} van {items.length} klaar om te plaatsen
              </span>
              <div className={styles.actions}>
                <button type="button" className={styles.secondary} onClick={requestClose}>
                  Annuleren
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={drafting || toPost.length === 0}
                  onClick={() => setPhase("confirming")}
                >
                  {toPost.length} plaatsen
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
