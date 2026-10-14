import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

interface UseDropdownPanelResult {
  wrapRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  panelRef: React.RefObject<HTMLDivElement | null>;
  panelStyle: CSSProperties;
}

/** Shared behavior for a trigger-button-plus-popover-panel dropdown
 * (DateRangeSelector, FilterDropdown, ...): closes on an outside click,
 * and positions the panel against the viewport (fixed, clamped to stay
 * on-screen) rather than relative to the trigger's own — often narrow,
 * flex-shrunk — wrapper, which a plain `right: 0` could push off-screen
 * on narrow layouts. */
export function useDropdownPanel(open: boolean, onClose: () => void): UseDropdownPanelResult {
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open, onClose]);

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

  return { wrapRef, triggerRef, panelRef, panelStyle };
}
