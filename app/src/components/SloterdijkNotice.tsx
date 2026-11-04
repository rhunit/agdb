import styles from "./SloterdijkNotice.module.css";

/** Temporary notice: replies on Coffeeshop Sloterdijk's reviews were lost
 * when the Google account was handed over, so its "onbeantwoord" count is
 * far higher than real. Remove once Google has restored them (or not). */
export function SloterdijkNotice() {
  return (
    <div className={styles.notice} role="status">
      <div className={styles.icon} aria-hidden="true">
        !
      </div>
      <div className={styles.body}>
        <div className={styles.title}>Coffeeshop Sloterdijk is toegevoegd</div>
        <div className={styles.text}>
          Tijdens de overdracht van het account zijn de reacties op de beoordelingen van Coffeeshop Sloterdijk komen te
          vervallen. Daardoor is het aantal onbeantwoorde reviews op dit moment erg hoog. We zijn met Google in gesprek
          om dit indien mogelijk terug te draaien.
        </div>
      </div>
    </div>
  );
}
