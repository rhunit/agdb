import { useEffect, useRef, useState } from "react";
import { fetchAiChatAvailable, sendChatMessage, type ChatMessage } from "../lib/api";
import styles from "./AiChatPanel.module.css";

interface AiChatPanelProps {
  /** Plain-text snapshot of the current dashboard stats, sent along with
   * every chat message so the assistant can answer things like "hoeveel
   * reviews zijn binnengekomen" — see ../lib/aiChatContext.ts. */
  contextSummary: string;
  /** Short "period · location" label shown in the panel so it's clear
   * what the assistant currently can and can't see. */
  contextLabel: string;
}

/** Floating "AI"-knop, rechtsonder, die een in-/uitklapbaar chatpaneel
 * toont — bedoeld als vervanger voor een los ChatGPT-tabblad, zodat
 * iemand dit open kan laten staan terwijl ze in het dashboard werken.
 * Ziet de actuele dashboardcijfers (zie contextSummary), niet de losse
 * reviewteksten. Draait op dezelfde OPENAI_API_KEY als de
 * Rapportage-samenvatting. Embedding van chatgpt.com zelf is niet
 * mogelijk (OpenAI blokkeert dat met X-Frame-Options/CSP, net als
 * vrijwel elke site met een login), dus dit praat rechtstreeks met de
 * OpenAI API in plaats van hun site te tonen. */
export function AiChatPanel({ contextSummary, contextLabel }: AiChatPanelProps) {
  const [open, setOpen] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAiChatAvailable().then(setAvailable);
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, sending]);

  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setSending(true);
    setError(null);
    const result = await sendChatMessage(next, contextSummary);
    setSending(false);
    if (result.ok) {
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
    } else {
      setError(result.error);
    }
  }

  return (
    <div className={styles.wrap} data-print-hide>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="AI-assistent">
          <div className={styles.header}>
            <span className={styles.headerTitle}>
              <span className={styles.headerTitleText}>AI-assistent</span>
              {available === false && (
                <span className={styles.comingSoonBadge}>Binnenkort beschikbaar</span>
              )}
            </span>
            <button
              type="button"
              className={styles.closeButton}
              onClick={() => setOpen(false)}
              aria-label="Sluiten"
            >
              ✕
            </button>
          </div>

          {available === null ? (
            <div className={styles.statusText}>Even controleren...</div>
          ) : available === false ? (
            <div className={styles.statusText}>
              Deze functie werkt nog niet — we zijn hier nog aan het werken.
            </div>
          ) : (
            <>
              <div className={styles.contextBar}>Ziet: {contextLabel}</div>
              <div className={styles.messages} ref={listRef}>
                {messages.length === 0 && (
                  <div className={styles.statusText}>
                    Stel een vraag — ik zie de huidige dashboardcijfers hierboven, maar geen
                    losse reviewteksten.
                  </div>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={
                      m.role === "user" ? styles.bubbleUser : styles.bubbleAssistant
                    }
                  >
                    {m.content}
                  </div>
                ))}
                {sending && <div className={styles.statusText}>Bezig met typen...</div>}
                {error && <div className={styles.errorText}>{error}</div>}
              </div>

              <div className={styles.inputRow}>
                <textarea
                  className={styles.input}
                  rows={2}
                  placeholder="Typ een bericht..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />
                <button
                  type="button"
                  className={styles.sendButton}
                  onClick={send}
                  disabled={sending || !input.trim()}
                >
                  Versturen
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        className={styles.fab}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label="AI-assistent"
      >
        AI
      </button>
    </div>
  );
}
