import type { DateRange } from "./dateRange";
import type { StarCounts } from "./reportCalc";
import type { LocationId, Review } from "../types";

// Numbers and fixed wording for the PDF export of Rapportage ("Google
// Reviews | Samen sterk"). Counted here, in the dashboard; only the
// per-location narratives and the overview paragraph come from the AI.

export const REPORT_CATEGORIES = ["Personeel", "Huisregels", "Handel", "Overig/onbekend"] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

/** Order of the locations in the report (as in the business's own template). */
export const REPORT_LOCATION_ORDER: LocationId[] = [
  "boerejongens",
  "centrum",
  "depijp",
  "almere",
  "sloterdijk",
  "amsterdamgenetics",
];

const MONTHS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];
const NUMBER_WORDS = ["nul", "één", "twee", "drie", "vier", "vijf", "zes", "zeven", "acht", "negen", "tien", "elf", "twaalf"];

/** "9 t/m 15 november 2026", "28 oktober t/m 3 november 2026". */
export function formatPeriod(range: DateRange): string {
  const { start, end } = range;
  const d = (x: Date) => x.getDate();
  const m = (x: Date) => MONTHS[x.getMonth()];
  if (start.toDateString() === end.toDateString()) return `${d(start)} ${m(start)} ${start.getFullYear()}`;
  if (start.getFullYear() !== end.getFullYear()) {
    return `${d(start)} ${m(start)} ${start.getFullYear()} t/m ${d(end)} ${m(end)} ${end.getFullYear()}`;
  }
  if (start.getMonth() !== end.getMonth()) return `${d(start)} ${m(start)} t/m ${d(end)} ${m(end)} ${end.getFullYear()}`;
  return `${d(start)} t/m ${d(end)} ${m(end)} ${end.getFullYear()}`;
}

/** A week (or less) is a "weekrapport"; anything longer just a "rapport". */
export function isWeekLong(range: DateRange): boolean {
  return (range.end.getTime() - range.start.getTime()) / 86_400_000 < 7.5;
}

export function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

export function formatAverage(counts: StarCounts): string {
  const total = countTotal(counts);
  if (total === 0) return "—";
  const sum = (5 * counts[5] + 4 * counts[4] + 3 * counts[3] + 2 * counts[2] + counts[1]) / total;
  return sum.toFixed(2).replace(".", ",");
}

export function formatFivePct(counts: StarCounts): string {
  const total = countTotal(counts);
  if (total === 0) return "—";
  const pct = (counts[5] / total) * 100;
  return pct === 100 ? "100%" : `${pct.toFixed(1).replace(".", ",")}%`;
}

export function countTotal(c: StarCounts): number {
  return c[1] + c[2] + c[3] + c[4] + c[5];
}

const STAR_WORDS: Record<number, string> = {
  5: "vijf sterren",
  4: "vier sterren",
  3: "drie sterren",
  2: "twee sterren",
  1: "één ster",
};
const SINGLE_REVIEW: Record<number, string> = {
  5: "één vijfsterrenbeoordeling",
  4: "één viersterrenbeoordeling",
  3: "één driesterrenbeoordeling",
  2: "één tweesterrenbeoordeling",
  1: "één eensterrenbeoordeling",
};

/** "31 reviews: 27 vijf sterren, 1 drie sterren, 1 twee sterren en 2 één ster. Gemiddeld 4,55." */
export function starSentence(counts: StarCounts): string {
  const total = countTotal(counts);
  if (total === 0) return "Geen reviews in deze periode.";
  if (total === 1) {
    const star = ([5, 4, 3, 2, 1] as const).find((s) => counts[s] === 1)!;
    return `1 review: ${SINGLE_REVIEW[star]}, gemiddeld ${formatAverage(counts)}.`;
  }
  const parts = ([5, 4, 3, 2, 1] as const).filter((s) => counts[s] > 0).map((s) => `${counts[s]} ${STAR_WORDS[s]}`);
  const list = parts.length > 1 ? `${parts.slice(0, -1).join(", ")} en ${parts[parts.length - 1]}` : parts[0];
  return `${total} reviews: ${list}. Gemiddeld ${formatAverage(counts)}.`;
}

/** Without the AI: a rough category from words in the review. */
export function keywordCategories(text: string): ReportCategory[] {
  const t = text.toLowerCase();
  if (!t.trim()) return ["Overig/onbekend"];
  const out: ReportCategory[] = [];
  if (/\b(personeel|medewerker|staff|employee|onvriendelijk|unfriendly|rude|bot\b|service|behandel|treat|advies|advice|uitleg|wacht|wait|bediening|budtender|kassa|counter|vriendelijk)/.test(t)) {
    out.push("Personeel");
  }
  if (/\b(id\b|identiteit|legitim|paspoort|passport|toegang|weiger|refus|denied|leeftijd|age\b|regel|rules|roken|smok|binnengelaten|entry|discrimin)/.test(t)) {
    out.push("Huisregels");
  }
  if (/\b(product|kwaliteit|quality|wiet|weed|hasj|hash|cake|edible|space|prijs|price|duur\b|expensive|sterk|strong|zwak|weak|joint|pre-?roll|gram|assortiment|smaak|taste|tabak|tobacco)/.test(t)) {
    out.push("Handel");
  }
  return out.length > 0 ? out : ["Overig/onbekend"];
}

export type CategoryCounts = Record<ReportCategory, StarCounts>;

/** Per category, how many 1-3 star reviews (a review can count in several). */
export function categoryTable(reviews: Review[], categoriesOf: (r: Review) => ReportCategory[]): CategoryCounts {
  const empty = (): StarCounts => ({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  const table = Object.fromEntries(REPORT_CATEGORIES.map((c) => [c, empty()])) as CategoryCounts;
  for (const r of reviews) {
    if (r.rating > 3) continue;
    for (const c of categoriesOf(r)) table[c][r.rating]++;
  }
  return table;
}

/** "4 unieke negatieve reviews; 6 categorievermeldingen, …" — before the AI's narrative. */
export function negativeCountSentence(reviews: Review[], table: CategoryCounts): string {
  const unique = reviews.filter((r) => r.rating <= 3).length;
  if (unique === 0) return "";
  const mentions = REPORT_CATEGORIES.reduce((n, c) => n + table[c][1] + table[c][2] + table[c][3], 0);
  const head = unique === 1 ? "1 unieke negatieve review" : `${unique} unieke negatieve reviews`;
  return mentions > unique
    ? `${head}; ${mentions} categorievermeldingen, omdat een review meerdere categorieën kan raken.`
    : `${head}.`;
}

export const CLOSING_TEXT =
  "Dank aan alle teams voor het werk achter iedere beoordeling, van een vriendelijk welkom tot het laatste advies aan de balie. De complimenten laten zien dat klanten die aandacht echt merken. En de kritische reacties? Die geven ons concrete kansen om duidelijker, zorgvuldiger en consistenter te worden. Neem de goede energie mee, bespreek de verbeterpunten met elkaar en maak er samen weer een sterke week van. Op naar nieuwe tevreden bezoekers!";

function joinNames(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} en ${names[names.length - 1]}` : names[0];
}

/** The paragraph under "De week in één oogopslag" — written from the table's
 * own numbers (not by the AI, which once got them wrong): most volume,
 * highest share of five stars (with a warning when that rests on very few
 * reviews), a location that lags behind, locations without reviews. */
export function overviewSentence(locations: { name: string; counts: StarCounts }[]): string {
  const withReviews = locations.filter((l) => countTotal(l.counts) > 0);
  const without = locations.filter((l) => countTotal(l.counts) === 0).map((l) => l.name);
  if (withReviews.length === 0) return "In deze periode zijn er bij geen enkele locatie reviews binnengekomen.";

  const sentences: string[] = [];
  const maxTotal = Math.max(...withReviews.map((l) => countTotal(l.counts)));
  const busiest = withReviews.filter((l) => countTotal(l.counts) === maxTotal);
  const volume = `${joinNames(busiest.map((l) => l.name))} ${busiest.length > 1 ? "pakken" : "pakt"} het meeste volume (${maxTotal} reviews${busiest.length > 1 ? " elk" : ""})`;

  const share = (l: { counts: StarCounts }) => l.counts[5] / countTotal(l.counts);
  const bestShare = Math.max(...withReviews.map(share));
  const best = withReviews.filter((l) => share(l) === bestShare && !busiest.includes(l));
  if (best.length > 0 && bestShare > 0) {
    const fewest = Math.min(...best.map((l) => countTotal(l.counts)));
    const pct = formatFivePct(best[0].counts);
    const few = fewest < 5;
    sentences.push(
      `${volume}; ${joinNames(best.map((l) => l.name))} ${best.length > 1 ? "halen" : "haalt"} ${pct} vijf sterren${
        few ? `, maar op slechts ${fewest === 1 ? "één beoordeling" : `${fewest} beoordelingen`}` : ""
      }.`,
    );
    if (few) {
      sentences.push(
        "Een percentage over zo weinig reviews is geen eerlijke vergelijking met een locatie met tientallen beoordelingen.",
      );
    }
  } else {
    sentences.push(`${volume}.`);
  }

  const average = (l: { counts: StarCounts }) =>
    (5 * l.counts[5] + 4 * l.counts[4] + 3 * l.counts[3] + 2 * l.counts[2] + l.counts[1]) / countTotal(l.counts);
  const lagging = withReviews.filter((l) => average(l) < 4);
  if (lagging.length > 0) {
    sentences.push(
      `${joinNames(lagging.map((l) => `${l.name} (gemiddeld ${formatAverage(l.counts)} over ${countTotal(l.counts) === 1 ? "één review" : `${countTotal(l.counts)} reviews`})`))} ${lagging.length > 1 ? "blijven" : "blijft"} achter.`,
    );
  }
  if (without.length > 0) {
    sentences.push(`${joinNames(without)} ${without.length > 1 ? "kregen" : "kreeg"} in deze periode geen reviews.`);
  }
  return sentences.join(" ");
}
