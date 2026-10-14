import styles from "./ExportPdfButton.module.css";

/** Exports exactly what's currently on screen — same filters, date range
 * and sort order — via the browser's native print-to-PDF, so there's no
 * extra dependency or server round-trip. The print stylesheet (index.css)
 * strips the chrome (sidebar, buttons, dropdown panels) and keeps the
 * data. `data-print-hide` keeps the button itself out of its own output. */
export function ExportPdfButton() {
  return (
    <button
      type="button"
      className={styles.button}
      data-print-hide
      onClick={() => window.print()}
    >
      Exporteer naar PDF
    </button>
  );
}
