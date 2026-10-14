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

interface DateRangeSelectorProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangeSelector({ value, onChange }: DateRangeSelectorProps) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(() => toInputValue(value.start));
  const [customEnd, setCustomEnd] = useState(() => toInputValue(value.end));
  const { wrapRef, triggerRef, panelRef, panelStyle } = useDropdownPanel(open, () =>
    setOpen(false),
  );

  function pickPreset(preset: DateRangePreset) {
    onChange(rangeForPreset(preset));
    setOpen(false);
  }

  function applyCustom() {
    if (!customStart || !customEnd) return;
    const start = new Date(customStart);
    const end = new Date(customEnd);
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
        onClick={() => setOpen((o) => !o)}
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
