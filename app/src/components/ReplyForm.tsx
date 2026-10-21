import { useState } from "react";
import { useAccount } from "../hooks/useAccount";
import { generateReplyDraft, submitReviewReply } from "../lib/api";
import type { LocationId } from "../types";
import styles from "./ReplyForm.module.css";

type Stage = "closed" | "editing" | "confirming" | "submitting";

interface ReplyFormProps {
  location: LocationId;
  googleReviewId: string;
  /** The review being answered — what the AI draft is written from. */
  reviewer: string;
  rating: number;
  reviewText: string;
  /** Called once the reply has actually been posted to Google, with the
   * text that was sent — the caller shows it immediately rather than
   * waiting for the next full refetch. */
  onSent: (text: string) => void;
}

/** Inline reply control for one review — posts straight to Google's public
 * listing, so sending always goes through an explicit confirm step rather
 * than firing on the first click. Only shown to accounts with the "reply"
 * permission (the server enforces the same). "Genereer opzet" fills the
 * text field with an AI draft per the reply rules, to edit before sending. */
export function ReplyForm({
  location,
  googleReviewId,
  reviewer,
  rating,
  reviewText,
  onSent,
}: ReplyFormProps) {
  const { account, can } = useAccount();
  const [stage, setStage] = useState<Stage>("closed");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [drafting, setDrafting] = useState(false);

  if (!can("reply")) return null;
  const draftAvailable = account?.replyDraftAvailable ?? false;

  async function generateDraft() {
    if (text.trim() && !window.confirm("Je huidige tekst vervangen door een nieuwe opzet?")) {
      return;
    }
    setDrafting(true);
    setError(null);
    const result = await generateReplyDraft({ location, reviewer, rating, text: reviewText });
    setDrafting(false);
    if (result.ok) setText(result.draft);
    else setError(result.error);
  }

  function close() {
    setStage("closed");
    setText("");
    setError(null);
  }

  async function send() {
    setStage("submitting");
    setError(null);
    const sentText = text.trim();
    const result = await submitReviewReply(location, googleReviewId, sentText);
    if (result.ok) {
      onSent(sentText);
      close();
    } else {
      setError(result.error);
      setStage("editing");
    }
  }

  if (stage === "closed") {
    return (
      <button
        type="button"
        className={styles.toggle}
        data-print-hide
        onClick={() => setStage("editing")}
      >
        Beantwoorden
      </button>
    );
  }

  return (
    <div className={styles.form} data-print-hide>
      <textarea
        className={styles.textarea}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={
          draftAvailable
            ? "Typ je antwoord, of klik op \"Genereer opzet\"..."
            : "Typ je antwoord..."
        }
        rows={text.length > 200 ? 7 : 3}
        disabled={stage === "submitting" || drafting}
        autoFocus
      />
      {error && <div className={styles.error}>{error}</div>}

      {stage === "confirming" ? (
        <div className={styles.confirmRow}>
          <span className={styles.confirmText}>
            Dit antwoord wordt direct openbaar geplaatst op Google. Weet je het zeker?
          </span>
          <div className={styles.actions}>
            <button type="button" className={styles.secondary} onClick={() => setStage("editing")}>
              Terug
            </button>
            <button type="button" className={styles.confirm} onClick={send}>
              Ja, versturen
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.draft}
            disabled={!draftAvailable || drafting || stage === "submitting"}
            title={draftAvailable ? undefined : "AI-opzet is binnenkort beschikbaar"}
            onClick={generateDraft}
          >
            {drafting
              ? "Opzet schrijven..."
              : draftAvailable
                ? text.trim()
                  ? "✨ Nieuwe opzet"
                  : "✨ Genereer opzet"
                : "✨ Opzet · binnenkort beschikbaar"}
          </button>
          <button type="button" className={styles.secondary} onClick={close}>
            Annuleren
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={!text.trim() || stage === "submitting"}
            onClick={() => setStage("confirming")}
          >
            {stage === "submitting" ? "Versturen..." : "Versturen"}
          </button>
        </div>
      )}
    </div>
  );
}
