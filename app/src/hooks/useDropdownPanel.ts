import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

interface UseDropdownPanelResult {
  wrapRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  panelRef: React.RefObject<HTMLDivElement | null>;
  panelStyle: CSSProperties;
}

/** Shared behavior for a trigger-button-plus-popover-panel dropdown
 * (DateRangeSelector, FilterDropdown, ...): closes on an outside click,
 * and positions the panel `position: absolute` right under the trigger —
 * so it scrolls with the page and stays attached to the control that
 * opened it, rather than staying pinned to a viewport coordinate while
 * the trigger scrolls away underneath it. The horizontal offset is still
 * computed in JS and clamped to the viewport width, since a plain
 * `right: 0` relative to the trigger's own — often narrow, flex-shrunk —
 * wrapper can push the panel off-screen on narrow layouts; `wrapRect`
 * only ever supplies its stable top-left corner for that conversion; the
 * desired position itself is always measured from the trigger, which
 * (unlike the wrap) never changes size when the panel opens. */
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
    if (!open || !triggerRef.current || !panelRef.current || !wrapRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const wrapRect = wrapRef.current.getBoundingClientRect();
    const panelWidth = panelRef.current.offsetWidth;
    const margin = 12;
    const desiredViewportLeft = triggerRect.right - panelWidth;
    const clampedViewportLeft = Math.min(
      Math.max(desiredViewportLeft, margin),
      window.innerWidth - panelWidth - margin,
    );
    setPanelStyle({
      position: "absolute",
      top: triggerRect.bottom - wrapRect.top + 6,
      left: clampedViewportLeft - wrapRect.left,
    });
  }, [open]);

  return { wrapRef, triggerRef, panelRef, panelStyle };
}
