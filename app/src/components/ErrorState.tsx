import loadingStyles from "./LoadingState.module.css";
import styles from "./ErrorState.module.css";

/** Takes LoadingState's place when the data a page needs couldn't be
 * fetched — instead of spinning forever, or falling back to mock numbers
 * that would look real. The banner above says what went wrong. */
export function ErrorState() {
  return (
    <div className={loadingStyles.wrap}>
      <img
        className={loadingStyles.professorImg}
        src="https://www.amsterdamgenetics.com/wp-content/uploads/2023/10/2023_homepage_profh.jpg.webp"
        alt="Professor Harvest"
        loading="lazy"
      />
      <div className={styles.title}>De data kon niet worden geladen</div>
      <div className={loadingStyles.text}>
        Zie de melding bovenaan de pagina voor de oorzaak en wat je kunt doen.
      </div>
    </div>
  );
}
