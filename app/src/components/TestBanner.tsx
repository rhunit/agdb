import styles from "./TestBanner.module.css";

export function TestBanner() {
  return (
    <div className={styles.banner} role="alert">
      <span className={styles.icon}>!</span>
      <span>
        TESTVERSIE — alleen cijfers met een <strong>LIVE</strong>-badge zijn
        actuele Google-data. Overige cijfers zijn voorbeelddata.
      </span>
    </div>
  );
}
