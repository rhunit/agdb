import { useMemo, useState } from "react";
import { useAccount } from "../hooks/useAccount";
import { useLiveResource } from "../hooks/useLiveResource";
import {
  fetchMentions,
  runMentionCheck,
  setMentionHidden,
  type Mention,
  type MentionSource,
} from "../lib/api";
import { isWithinRange, rangeForPreset, type DateRange } from "../lib/dateRange";
import { formatReviewTimestamp } from "../lib/format";
import { triggerRefresh } from "../lib/refresh";
import { DateRangeSelector } from "./DateRangeSelector";
import { FilterDropdown, type FilterOption } from "./FilterDropdown";
import { LoadingState } from "./LoadingState";
import { MentionTermsEditor } from "./MentionTermsEditor";
import styles from "./MentionsPage.module.css";

const SOURCE_LABEL: Record<MentionSource, string> = {
  reddit: "Reddit",
  news: "Nieuws",
  alerts: "Web",
};

const SOURCE_HINT: Record<MentionSource, string> = {
  reddit: "Nog niet gekoppeld: zet REDDIT_CLIENT_ID en REDDIT_CLIENT_SECRET op Northflank.",
  news: "",
  alerts: "Nog geen Google Alerts-feed: voeg die per zoekterm toe onder Zoektermen.",
};

// Per viewer, just for the "Nieuw" badges — fine to lose.
const LAST_SEEN_KEY = "ag-mentions-last-seen";

function readLastSeen(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

function when(m: Mention): string {
  return m.publishedAt ?? m.foundAt;
}

/** "Vermeldingen": where the tracked company and shop names came up online
 * (Reddit, news, pages Google Alerts found). The server checks every 30
 * minutes; what's shown is the title and first line straight from the
 * source, with a link to it. */
export function MentionsPage() {
  const { can } = useAccount();
  const { data, setData, loading, failed } = useLiveResource(fetchMentions);
  const [dateRange, setDateRange] = useState<DateRange>(() => rangeForPreset("all-time"));
  const [termFilter, setTermFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [visibility, setVisibility] = useState<"shown" | "hidden">("shown");
  const [checking, setChecking] = useState(false);
  const [checkMessage, setCheckMessage] = useState<string | null>(null);
  // Read once per visit: what was new since the previous visit stays
  // marked while on the page; the next visit starts from now.
  const [lastSeen] = useState(() => {
    const previous = readLastSeen();
    try {
      localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
    } catch {
      // Private mode / blocked storage: no "Nieuw" badges, nothing else.
    }
    return previous;
  });

  const inRange = useMemo(
    () => (data?.items ?? []).filter((m) => isWithinRange(new Date(when(m)), dateRange)),
    [data, dateRange],
  );
  const hiddenCount = inRange.filter((m) => m.hidden).length;
  const visible = useMemo(
    () =>
      inRange.filter(
        (m) =>
          (visibility === "hidden") === m.hidden &&
          (termFilter === "all" || m.terms.includes(termFilter)) &&
          (sourceFilter === "all" || m.source === sourceFilter),
      ),
    [inRange, visibility, termFilter, sourceFilter],
  );

  const shown = inRange.filter((m) => !m.hidden);
  const termOptions: FilterOption[] = [
    { value: "all", label: "Alle zoektermen" },
    ...(data?.terms ?? []).map((t) => ({
      value: t.term,
      label: t.term,
      count: shown.filter((m) => m.terms.includes(t.term)).length,
    })),
  ];
  const sourceOptions: FilterOption[] = [
    { value: "all", label: "Alle bronnen" },
    ...(Object.keys(SOURCE_LABEL) as MentionSource[]).map((s) => ({
      value: s,
      label: SOURCE_LABEL[s],
      count: shown.filter((m) => m.source === s).length,
    })),
  ];

  async function checkNow() {
    setChecking(true);
    setCheckMessage(null);
    const result = await runMentionCheck();
    setChecking(false);
    if (!result.ok) {
      setCheckMessage(result.error);
      return;
    }
    setCheckMessage(
      result.data.added === 0
        ? "Geen nieuwe vermeldingen gevonden."
        : `${result.data.added} nieuwe vermelding${result.data.added === 1 ? "" : "en"} gevonden.`,
    );
    triggerRefresh();
  }

  async function toggleHidden(mention: Mention) {
    const result = await setMentionHidden(mention.id, !mention.hidden);
    if (result.ok) {
      setData((prev) =>
        prev ? { ...prev, items: prev.items.map((m) => (m.id === mention.id ? result.data : m)) } : prev,
      );
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Vermeldingen</div>
          <div className={styles.subtitle}>
            Waar jullie namen online genoemd worden: Reddit, nieuws en het web (Google Alerts).
            Wordt elke 30 minuten automatisch bijgewerkt.
          </div>
        </div>
        <div className={styles.headerRight}>
          <button
            type="button"
            className={styles.checkButton}
            onClick={checkNow}
            disabled={checking}
            data-print-hide
          >
            {checking ? "Zoeken..." : "Nu zoeken"}
          </button>
          <DateRangeSelector value={dateRange} onChange={setDateRange} />
        </div>
      </div>

      {checkMessage && (
        <div className={styles.notice} role="status">
          {checkMessage}
        </div>
      )}

      {loading ? (
        <LoadingState />
      ) : failed || !data ? (
        <div className={styles.card}>
          <div className={styles.empty}>De vermeldingen konden niet worden geladen.</div>
        </div>
      ) : (
        <>
          <div className={styles.tiles}>
            <div className={styles.tile}>
              <div className={styles.tileLabel}>Vermeldingen</div>
              <div className={styles.tileValue}>{shown.length}</div>
            </div>
            {(Object.keys(SOURCE_LABEL) as MentionSource[]).map((s) => (
              <div className={styles.tile} key={s}>
                <div className={styles.tileLabel}>{SOURCE_LABEL[s]}</div>
                <div className={styles.tileValue}>{shown.filter((m) => m.source === s).length}</div>
              </div>
            ))}
          </div>

          <div className={styles.filters}>
            <FilterDropdown
              label="Zoekterm"
              options={termOptions}
              value={termFilter}
              onChange={setTermFilter}
            />
            <FilterDropdown
              label="Bron"
              options={sourceOptions}
              value={sourceFilter}
              onChange={setSourceFilter}
            />
            <FilterDropdown
              label="Zichtbaarheid"
              options={[
                { value: "shown", label: "Relevant" },
                { value: "hidden", label: "Niet relevant", count: hiddenCount },
              ]}
              value={visibility}
              onChange={(v) => setVisibility(v as "shown" | "hidden")}
            />
          </div>

          <div className={styles.card}>
            {visible.length === 0 ? (
              <div className={styles.empty}>
                {visibility === "hidden"
                  ? "Niets als niet relevant gemarkeerd in deze periode."
                  : "Nog geen vermeldingen gevonden in deze periode."}
              </div>
            ) : (
              <ul className={styles.list}>
                {visible.map((m) => {
                  const isNew = lastSeen !== null && m.foundAt > lastSeen;
                  return (
                    <li className={styles.item} key={m.id}>
                      <span className={`${styles.sourceBadge} ${styles[`source_${m.source}`]}`}>
                        {SOURCE_LABEL[m.source]}
                      </span>
                      <div className={styles.body}>
                        <a
                          className={styles.itemTitle}
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {m.title || m.url}
                        </a>
                        {m.firstLine && <div className={styles.firstLine}>{m.firstLine}</div>}
                        <div className={styles.meta}>
                          <span>{m.sourceName}</span>
                          <span>· {formatReviewTimestamp(when(m))}</span>
                          {m.terms.map((t) => (
                            <span key={t} className={styles.termChip}>
                              {t}
                            </span>
                          ))}
                          {m.hidden && m.hiddenBy && <span>· verborgen door {m.hiddenBy}</span>}
                        </div>
                      </div>
                      <div className={styles.aside}>
                        {isNew && <span className={styles.newBadge}>Nieuw</span>}
                        <a
                          className={styles.openLink}
                          href={m.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Bekijk bron ↗
                        </a>
                        <button
                          type="button"
                          className={styles.hideButton}
                          onClick={() => toggleHidden(m)}
                          data-print-hide
                        >
                          {m.hidden ? "Toch tonen" : "Niet relevant"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Bronnen</div>
            <ul className={styles.statusList}>
              {(Object.keys(SOURCE_LABEL) as MentionSource[]).map((s) => {
                const st = data.sources[s];
                return (
                  <li key={s} className={styles.statusRow}>
                    <span className={styles.statusName}>{SOURCE_LABEL[s]}</span>
                    {!st.configured ? (
                      <span className={styles.statusMuted}>{SOURCE_HINT[s]}</span>
                    ) : st.lastError ? (
                      <span className={styles.statusError}>Fout bij laatste controle: {st.lastError}</span>
                    ) : st.lastRunAt ? (
                      <span className={styles.statusOk}>
                        Werkt · laatst gecontroleerd {formatReviewTimestamp(st.lastRunAt)}
                      </span>
                    ) : (
                      <span className={styles.statusMuted}>Wacht op de eerste controle.</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          {can("admin") && (
            <MentionTermsEditor
              terms={data.terms}
              onSaved={(terms) => setData((prev) => (prev ? { ...prev, terms } : prev))}
            />
          )}
        </>
      )}
    </div>
  );
}
