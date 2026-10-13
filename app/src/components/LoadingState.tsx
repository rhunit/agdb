import styles from "./LoadingState.module.css";

export function LoadingState() {
  return (
    <div className={styles.wrap}>
      <img
        className={styles.professorImg}
        src="https://www.amsterdamgenetics.com/wp-content/uploads/2023/10/2023_homepage_profh.jpg.webp"
        alt="Professor Harvest"
        loading="lazy"
      />
      <div className={styles.spinner} aria-hidden="true" />
      <div className={styles.text}>Data wordt geladen, één momentje&hellip;</div>
    </div>
  );
}
