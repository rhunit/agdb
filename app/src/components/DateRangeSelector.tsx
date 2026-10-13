import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  // Positions the panel against the viewport rather than the trigger's own
  // (often narrow, flex-shrunk) wrapper — a right-aligned offset relative
  // to that wrapper pushes the panel off-screen on narrow layouts where
  // the trigger itself sits near the left edge.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !panelRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const panelWidth = panelRef.current.offsetWidth;
    const margin = 12;
    const left = Math.min(
      Math.max(triggerRect.right - panelWidth, margin),
      window.innerWidth - panelWidth - margin,
    );
    setPanelStyle({ position: "fixed", top: triggerRect.bottom + 6, left });
  }, [open]);

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
        <span className={styles.chevron} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className={styles.panel} style={panelStyle} ref={panelRef} role="menu">
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
