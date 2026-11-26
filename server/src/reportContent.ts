import type { BusinessReview } from "./googleBusinessReviews.js";
import type { InternalLocationId } from "./googleBusinessProfile.js";
import type { WeekReportResult } from "./weekReport.js";

// The weekly report ("Google Reviews | Samen sterk") as the server builds it
// for the e-mail: the same content as the PDF export on the Rapportage page.
// The wording and sums here mirror app/src/lib/weekReport.ts and
// app/src/components/WeekReport.tsx — change both together.

export const REPORT_CATEGORIES = ["Personeel", "Huisregels", "Handel", "Overig/onbekend"] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];
export type StarCounts = Record<1 | 2 | 3 | 4 | 5, number>;

/** Order and names as in the report (and the dashboard's tabs). */
export const REPORT_LOCATIONS: { id: InternalLocationId; name: string }[] = [
  { id: "boerejongens", name: "Boerejongens Centrum" },
  { id: "centrum", name: "Coffeeshop BIJ" },
  { id: "depijp", name: "Boerejongens West" },
  { id: "almere", name: "Boerejongens Almere" },
  { id: "sloterdijk", name: "Coffeeshop Sloterdijk" },
  { id: "amsterdamgenetics", name: "Amsterdam Genetics" },
];

const TZ = "Europe/Amsterdam";
const MONTHS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];
const NUMBER_WORDS = ["nul", "één", "twee", "drie", "vier", "vijf", "zes", "zeven", "acht", "negen", "tien", "elf", "twaalf"];

// ---- Dates (always Dutch time) ----

/** "2026-11-16" for a moment, in Dutch time. */
export function amsterdamDay(d: Date): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Monday 1 … Sunday 7 of a "2026-11-16" day. */
function weekday(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
}

export interface ReportPeriod {
  /** Monday, "2026-11-09". */
  start: string;
  /** Sunday, "2026-11-15". */
  end: string;
}

/** Monday to Sunday of the week before the one `now` falls in (Dutch time). */
export function previousWeek(now: Date): ReportPeriod {
  const today = amsterdamDay(now);
  const thisMonday = addDays(today, 1 - weekday(today));
  return { start: addDays(thisMonday, -7), end: addDays(thisMonday, -1) };
}

/** "9 t/m 15 november 2026", "26 oktober t/m 1 november 2026". */
export function formatPeriod(p: ReportPeriod): string {
  const [sy, sm, sd] = p.start.split("-").map(Number);
  const [ey, em, ed] = p.end.split("-").map(Number);
  if (p.start === p.end) return `${sd} ${MONTHS[sm - 1]} ${sy}`;
  if (sy !== ey) return `${sd} ${MONTHS[sm - 1]} ${sy} t/m ${ed} ${MONTHS[em - 1]} ${ey}`;
  if (sm !== em) return `${sd} ${MONTHS[sm - 1]} t/m ${ed} ${MONTHS[em - 1]} ${ey}`;
  return `${sd} t/m ${ed} ${MONTHS[em - 1]} ${ey}`;
}

/** The month blocks for a mail sent on `sendDay` ("2026-11-30"): the month
 * so far, from the 1st up to and including the day of sending. When the
 * previous weekly mail went out in an earlier month, that month's full
 * final standing comes first — that mail was sent before its last day(s)
 * were over, so they'd otherwise never be counted in a standing. */
export function monthBlocks(sendDay: string): { period: ReportPeriod; final: boolean }[] {
  const blocks: { period: ReportPeriod; final: boolean }[] = [];
  const previousSend = addDays(sendDay, -7);
  if (previousSend.slice(0, 7) !== sendDay.slice(0, 7)) {
    const lastDay = addDays(`${sendDay.slice(0, 8)}01`, -1);
    blocks.push({ period: { start: `${lastDay.slice(0, 8)}01`, end: lastDay }, final: true });
  }
  blocks.push({ period: { start: `${sendDay.slice(0, 8)}01`, end: sendDay }, final: false });
  return blocks;
}

export function monthName(day: string): string {
  const [y, m] = day.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export function inPeriod(iso: string | null, p: ReportPeriod): boolean {
  if (!iso) return false;
  const day = amsterdamDay(new Date(iso));
  return day >= p.start && day <= p.end;
}

// ---- Numbers and fixed wording ----

export function countTotal(c: StarCounts): number {
  return c[1] + c[2] + c[3] + c[4] + c[5];
}

export function starCounts(reviews: BusinessReview[]): StarCounts {
  const c: StarCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) if (r.rating >= 1 && r.rating <= 5) c[r.rating as 1]++;
  return c;
}

function average(c: StarCounts): number {
  return (5 * c[5] + 4 * c[4] + 3 * c[3] + 2 * c[2] + c[1]) / countTotal(c);
}

export function formatAverage(c: StarCounts): string {
  return countTotal(c) === 0 ? "—" : average(c).toFixed(2).replace(".", ",");
}

export function formatFivePct(c: StarCounts): string {
  const total = countTotal(c);
  if (total === 0) return "—";
  const pct = (c[5] / total) * 100;
  return pct === 100 ? "100%" : `${pct.toFixed(1).replace(".", ",")}%`;
}

const STAR_WORDS: Record<number, string> = { 5: "vijf sterren", 4: "vier sterren", 3: "drie sterren", 2: "twee sterren", 1: "één ster" };
const SINGLE_REVIEW: Record<number, string> = {
  5: "één vijfsterrenbeoordeling",
  4: "één viersterrenbeoordeling",
  3: "één driesterrenbeoordeling",
  2: "één tweesterrenbeoordeling",
  1: "één eensterrenbeoordeling",
};

function joinList(items: string[]): string {
  return items.length > 1 ? `${items.slice(0, -1).join(", ")} en ${items[items.length - 1]}` : items[0];
}

export function starSentence(c: StarCounts): string {
  const total = countTotal(c);
  if (total === 0) return "Geen reviews in deze periode.";
  if (total === 1) {
    const star = ([5, 4, 3, 2, 1] as const).find((s) => c[s] === 1)!;
    return `1 review: ${SINGLE_REVIEW[star]}, gemiddeld ${formatAverage(c)}.`;
  }
  const parts = ([5, 4, 3, 2, 1] as const).filter((s) => c[s] > 0).map((s) => `${c[s]} ${STAR_WORDS[s]}`);
  return `${total} reviews: ${joinList(parts)}. Gemiddeld ${formatAverage(c)}.`;
}

export function keywordCategories(text: string): ReportCategory[] {
  const t = text.toLowerCase();
  if (!t.trim()) return ["Overig/onbekend"];
  const out: ReportCategory[] = [];
  if (/\b(personeel|medewerker|staff|employee|onvriendelijk|unfriendly|rude|bot\b|service|behandel|treat|advies|advice|uitleg|wacht|wait|bediening|budtender|kassa|counter|vriendelijk)/.test(t)) out.push("Personeel");
  if (/\b(id\b|identiteit|legitim|paspoort|passport|toegang|weiger|refus|denied|leeftijd|age\b|regel|rules|roken|smok|binnengelaten|entry|discrimin)/.test(t)) out.push("Huisregels");
  if (/\b(product|kwaliteit|quality|wiet|weed|hasj|hash|cake|edible|space|prijs|price|duur\b|expensive|sterk|strong|zwak|weak|joint|pre-?roll|gram|assortiment|smaak|taste|tabak|tobacco)/.test(t)) out.push("Handel");
  return out.length > 0 ? out : ["Overig/onbekend"];
}

export function overviewSentence(locations: { name: string; counts: StarCounts }[]): string {
  const withReviews = locations.filter((l) => countTotal(l.counts) > 0);
  const without = locations.filter((l) => countTotal(l.counts) === 0).map((l) => l.name);
  if (withReviews.length === 0) return "In deze periode zijn er bij geen enkele locatie reviews binnengekomen.";

  const sentences: string[] = [];
  const maxTotal = Math.max(...withReviews.map((l) => countTotal(l.counts)));
  const busiest = withReviews.filter((l) => countTotal(l.counts) === maxTotal);
  const volume = `${joinList(busiest.map((l) => l.name))} ${busiest.length > 1 ? "pakken" : "pakt"} het meeste volume (${maxTotal} reviews${busiest.length > 1 ? " elk" : ""})`;
  const share = (l: { counts: StarCounts }) => l.counts[5] / countTotal(l.counts);
  const bestShare = Math.max(...withReviews.map(share));
  const best = withReviews.filter((l) => share(l) === bestShare && !busiest.includes(l));
  if (best.length > 0 && bestShare > 0) {
    const fewest = Math.min(...best.map((l) => countTotal(l.counts)));
    const few = fewest < 5;
    sentences.push(
      `${volume}; ${joinList(best.map((l) => l.name))} ${best.length > 1 ? "halen" : "haalt"} ${formatFivePct(best[0].counts)} vijf sterren${
        few ? `, maar op slechts ${fewest === 1 ? "één beoordeling" : `${fewest} beoordelingen`}` : ""
      }.`,
    );
    if (few) sentences.push("Een percentage over zo weinig reviews is geen eerlijke vergelijking met een locatie met tientallen beoordelingen.");
  } else {
    sentences.push(`${volume}.`);
  }
  const lagging = withReviews.filter((l) => average(l.counts) < 4);
  if (lagging.length > 0) {
    sentences.push(
      `${joinList(lagging.map((l) => `${l.name} (gemiddeld ${formatAverage(l.counts)} over ${countTotal(l.counts) === 1 ? "één review" : `${countTotal(l.counts)} reviews`})`))} ${lagging.length > 1 ? "blijven" : "blijft"} achter.`,
    );
  }
  if (without.length > 0) sentences.push(`${joinList(without)} ${without.length > 1 ? "kregen" : "kreeg"} in deze periode geen reviews.`);
  return sentences.join(" ");
}

// The review bonus rule, as on the Rapportage page ("Financiële indicatie",
// app/src/lib/reportCalc.ts POT_RULE): 5★ adds, 1-3★ subtracts, 4★ neutral.
export const POT_RULE = { fiveStarEur: 5, fourStarEur: 0, oneToThreeStarEur: -10 };

export function formatEur(n: number): string {
  return `${n < 0 ? "-" : ""}€ ${Math.round(Math.abs(n))}`;
}

export interface MonthStatusRow {
  name: string;
  five: number;
  four: number;
  low: number;
  total: number;
  fiveEur: string;
  lowEur: string;
  net: string;
}

function monthRow(name: string, c: StarCounts): MonthStatusRow {
  const low = c[1] + c[2] + c[3];
  const fiveEur = c[5] * POT_RULE.fiveStarEur;
  const lowEur = low * POT_RULE.oneToThreeStarEur;
  return {
    name,
    five: c[5],
    four: c[4],
    low,
    total: countTotal(c),
    fiveEur: formatEur(fiveEur),
    lowEur: formatEur(lowEur),
    net: formatEur(fiveEur + lowEur),
  };
}

export const CLOSING_TEXT =
  "Dank aan alle teams voor het werk achter iedere beoordeling, van een vriendelijk welkom tot het laatste advies aan de balie. De complimenten laten zien dat klanten die aandacht echt merken. En de kritische reacties? Die geven ons concrete kansen om duidelijker, zorgvuldiger en consistenter te worden. Neem de goede energie mee, bespreek de verbeterpunten met elkaar en maak er samen weer een sterke week van. Op naar nieuwe tevreden bezoekers!";

// ---- The whole report ----

export interface ReportModel {
  period: ReportPeriod;
  periodLabel: string;
  title: string;
  subtitle: string;
  glance: { name: string; counts: StarCounts; total: number; average: string; fivePct: string }[];
  glanceTotal: { counts: StarCounts; total: number; average: string; fivePct: string };
  overview: string;
  /** "Maandstand review bonus": the month so far (and the previous month's
   * final standing when the previous mail went out in that month). */
  monthStatus: { title: string; intro: string; rows: MonthStatusRow[]; total: MonthStatusRow }[];
  sections: {
    name: string;
    starSentence: string;
    /** Per category: 1★, 2★, 3★, total. Null when the location had no reviews. */
    categories: { category: ReportCategory; c1: number; c2: number; c3: number; total: number }[] | null;
    paragraph: string;
  }[];
  dataQuality: string;
  closing: string;
}

export function buildReportModel(
  period: ReportPeriod,
  locations: { id: string; name: string; reviews: BusinessReview[] }[],
  texts: WeekReportResult | null,
  removedInPeriod: number,
  /** Per month block (see monthBlocks): the reviews in it, per location. */
  months: { period: ReportPeriod; final: boolean; locations: { name: string; reviews: BusinessReview[] }[] }[] = [],
): ReportModel {
  const periodLabel = formatPeriod(period);
  const withCounts = locations.map((l) => ({ ...l, counts: starCounts(l.reviews) }));
  const total: StarCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const l of withCounts) for (const s of [1, 2, 3, 4, 5] as const) total[s] += l.counts[s];

  const sections = withCounts.map((loc) => {
    const aiCats = texts?.locations[loc.id]?.categories ?? {};
    const table = Object.fromEntries(REPORT_CATEGORIES.map((c) => [c, { 1: 0, 2: 0, 3: 0 }])) as Record<ReportCategory, Record<1 | 2 | 3, number>>;
    const negatives = loc.reviews.filter((r) => r.rating >= 1 && r.rating <= 3);
    for (const r of negatives) {
      const cats = aiCats[r.id]?.length ? aiCats[r.id] : keywordCategories(r.text);
      for (const c of cats) table[c][r.rating as 1 | 2 | 3]++;
    }
    const mentions = REPORT_CATEGORIES.reduce((n, c) => n + table[c][1] + table[c][2] + table[c][3], 0);
    const head = negatives.length === 1 ? "1 unieke negatieve review" : `${negatives.length} unieke negatieve reviews`;
    const countSentence =
      negatives.length === 0
        ? ""
        : mentions > negatives.length
          ? `${head}; ${mentions} categorievermeldingen, omdat een review meerdere categorieën kan raken.`
          : `${head}.`;
    const narrative = texts?.locations[loc.id]?.narrative ?? "";
    return {
      name: loc.name,
      starSentence: starSentence(loc.counts),
      categories:
        countTotal(loc.counts) === 0
          ? null
          : REPORT_CATEGORIES.map((c) => ({
              category: c,
              c1: table[c][1],
              c2: table[c][2],
              c3: table[c][3],
              total: table[c][1] + table[c][2] + table[c][3],
            })),
      paragraph: countTotal(loc.counts) === 0 ? "" : [countSentence, narrative].filter(Boolean).join(" "),
    };
  });

  const removedNote =
    removedInPeriod > 0
      ? ` In deze periode zijn ${removedInPeriod} review${removedInPeriod === 1 ? "" : "s"} als verwijderd gedetecteerd; die tellen hier niet mee.`
      : "";

  return {
    period,
    periodLabel,
    title: "GOOGLE REVIEWS | SAMEN STERK",
    subtitle: `Gezamenlijk weekrapport · ${periodLabel} · Voor alle ${NUMBER_WORDS[locations.length] ?? locations.length} de teams`,
    glance: withCounts.map((l) => ({
      name: l.name,
      counts: l.counts,
      total: countTotal(l.counts),
      average: formatAverage(l.counts),
      fivePct: formatFivePct(l.counts),
    })),
    glanceTotal: { counts: total, total: countTotal(total), average: formatAverage(total), fivePct: formatFivePct(total) },
    overview: overviewSentence(withCounts),
    monthStatus: months.map((month) => {
      const rows = month.locations.map((l) => monthRow(l.name, starCounts(l.reviews)));
      const all: StarCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      for (const l of month.locations) {
        const c = starCounts(l.reviews);
        for (const s of [1, 2, 3, 4, 5] as const) all[s] += c[s];
      }
      const rule = `Rekenregel: 5★ = +€${POT_RULE.fiveStarEur}, 4★ = €${POT_RULE.fourStarEur}, 1–3★ = −€${Math.abs(POT_RULE.oneToThreeStarEur)} per review.`;
      return month.final
        ? {
            title: `Eindstand review bonus · ${monthName(month.period.start)}`,
            intro: `De volledige maand ${formatPeriod(month.period)}: de eindstand voor de bonus. ${rule}`,
            rows,
            total: monthRow("Totaal", all),
          }
        : {
            title: `Maandstand review bonus · ${formatPeriod(month.period)}`,
            intro: `Stand van de maand tot en met vandaag, zodat elk team ziet waar het staat. ${rule}`,
            rows,
            total: monthRow("Totaal", all),
          };
    }),
    sections,
    dataQuality:
      `Bron: Google Business Profile, reviews met aanmaakdatum ${periodLabel}. De cijfers zijn momentopnamen van de beschikbare reviewrecords.${removedNote} ` +
      "Vergelijkingen met de vorige week zijn hier niet opgenomen. Negatieve reviews kunnen meerdere inhoudelijke categorieën raken, maar tellen in het sterrentotaal slechts één keer mee." +
      (texts
        ? " Letterlijke klantcitaten zijn bewust beperkt; samenvattingen onderscheiden klantmeningen van vastgestelde feiten."
        : " De categorieën zijn in deze versie automatisch op trefwoorden ingedeeld."),
    closing: CLOSING_TEXT,
  };
}
