import { useState } from "react";
import { useDropdownPanel } from "../hooks/useDropdownPanel";
import styles from "./FilterDropdown.module.css";

export interface FilterOption {
  value: string;
  label: string;
  /** Shown next to the label when set — omit for options where a count
   * wouldn't mean anything (e.g. sort order). */
  count?: number;
}

interface FilterDropdownProps {
  /** Accessible name for the trigger — not shown when a value is
   * selected, since the selected option's own label takes over then. */
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

/** Single-select dropdown filter — trigger shows the current selection,
 * opens a popover list of the alternatives. Used for every review filter
 * (status, rating, thema) and the sort order on "Alle reviews". */
export function FilterDropdown({ label, options, value, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const { wrapRef, triggerRef, panelRef, panelStyle } = useDropdownPanel(open, () =>
    setOpen(false),
  );
  const selected = options.find((o) => o.value === value);

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className={styles.trigger}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={label}
      >
        {selected
          ? `${selected.label}${selected.count != null ? ` (${selected.count})` : ""}`
          : label}
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
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="menuitemradio"
              aria-checked={opt.value === value}
              className={
                opt.value === value ? `${styles.option} ${styles.optionActive}` : styles.option
              }
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              <span>{opt.label}</span>
              {opt.count != null && <span className={styles.optionCount}>{opt.count}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
