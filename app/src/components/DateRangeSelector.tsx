import { useState } from "react";
import { useDropdownPanel } from "../hooks/useDropdownPanel";
import {
  formatRangeLabel,
  PRESET_LABELS,
  rangeForPreset,
  type DateRange,
  type DateRangePreset,
} from "../lib/dateRange";
import styles from "./DateRangeSelector.module.css";

const PRESETS: Exclude<DateRangePreset, "custom">[] = [
  "today",
  "7d",
  "this-month",
  "last-month",
  "this-year",
  "last-year",
  "all-time",
];

function toInputValue(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** "2026-10-15" as a local date — new Date("2026-10-15") would read it as
 * UTC midnight, which is the previous day west of UTC. */
function fromInputValue(value: string): Date {
  const [yyyy, mm, dd] = value.split("-").map(Number);
  return new Date(yyyy, mm - 1, dd);
}

/** What the "Aangepaste periode" fields start at when the menu opens: the
 * current range if it's already a custom one, otherwise the last 7 days —
 * not the start of whatever preset is active (for "Alle tijd" that's an
 * internal year-2000 placeholder, which nobody means to pick). */
function customDefaults(value: DateRange): { start: string; end: string } {
  const range = value.preset === "custom" ? value : rangeForPreset("7d");
  return { start: toInputValue(range.start), end: toInputValue(range.end) };
}

interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(() => customDefaults(value).start);
  const [customEnd, setCustomEnd] = useState(() => customDefaults(value).end);
  const { wrapRef, triggerRef, panelRef, panelStyle } = useDropdownPanel(open, () =>
    setOpen(false),
  );

  function pickPreset(preset: DateRangePreset) {
    onChange(rangeForPreset(preset));
    setOpen(false);
  }

  function applyCustom() {
    if (!customStart || !customEnd) return;
    const start = fromInputValue(customStart);
    const end = fromInputValue(customEnd);
    if (start > end) return;
    onChange(rangeForPreset("custom", new Date(), start, end));
    setOpen(false);
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className={styles.trigger}
        onClick={() => {
          if (!open) {
            // Fresh defaults each time the menu opens, so the fields never
            // show a stale or placeholder range from earlier.
            const defaults = customDefaults(value);
            setCustomStart(defaults.start);
            setCustomEnd(defaults.end);
          }
          setOpen((o) => !o);
        }}
        aria-expanded={open}
      >
        {formatRangeLabel(value)}
        <span className={styles.chevron} aria-hidden="true" data-print-hide>
          ▾
        </span>
      </button>

      {open && (
        <div
          className={styles.panel}
          style={panelStyle}
          ref={panelRef}
          role="menu"
          data-print-hide
        >
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              role="menuitemradio"
              aria-checked={value.preset === preset}
              className={
                value.preset === preset
                  ? `${styles.option} ${styles.optionActive}`
                  : styles.option
              }
              onClick={() => pickPreset(preset)}
            >
              {PRESET_LABELS[preset]}
            </button>
          ))}

          <div className={styles.divider} />

          <div className={styles.customLabel}>Aangepaste periode</div>
          <div className={styles.customRow}>
            <input
              type="date"
              className={styles.dateInput}
              value={customStart}
              max={customEnd}
              onChange={(e) => setCustomStart(e.target.value)}
            />
            <span className={styles.customSep}>–</span>
            <input
              type="date"
              className={styles.dateInput}
              value={customEnd}
              min={customStart}
              onChange={(e) => setCustomEnd(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={styles.applyButton}
            disabled={!customStart || !customEnd || customStart > customEnd}
            onClick={applyCustom}
          >
            Toepassen
          </button>
        </div>
      )}
    </div>
  );
}
