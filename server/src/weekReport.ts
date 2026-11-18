import { getOpenAiClient, isOpenAiConfigured } from "./openaiClient.js";

// The texts for the PDF export of Rapportage ("Google Reviews | Samen
// sterk", the joint weekly report): per location, which category each
// negative review falls under and a short narrative. The numbers — and the
// paragraph under the "De week in één oogopslag" table, which is only about
// numbers — come from the dashboard itself (the AI got those wrong once).
// Generated on demand when someone exports, never automatically.

export const REPORT_CATEGORIES = ["Personeel", "Huisregels", "Handel", "Overig/onbekend"] as const;
export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export interface WeekReportReview {
  id: string;
  rating: number;
  text: string;
}

export interface WeekReportLocation {
  id: string;
  name: string;
  reviews: WeekReportReview[];
}

export interface WeekReportRequest {
  periodLabel: string;
  locations: WeekReportLocation[];
}

export interface WeekReportResult {
  locations: Record<string, { narrative: string; categories: Record<string, ReportCategory[]> }>;
}

const MODEL = "gpt-4o-mini";
const MAX_NEGATIVE = 60;
const MAX_POSITIVE = 40;
const MAX_TEXT = 600;

export function isWeekReportAvailable(): boolean {
  return isOpenAiConfigured();
}

const STYLE = `Schrijf in zakelijk, helder Nederlands voor de teams van een coffeeshop. Toon: positief maar eerlijk.
Schrijf uitsluitend op basis van de reviews die je krijgt; verzin niets. Wat klanten beweren zijn klantclaims, geen vastgestelde feiten: benoem dat waar het ertoe doet (bijvoorbeeld "Dit zijn klantclaims, geen vastgestelde productfouten." of "Dat vermoeden is niet vastgesteld."). Gebruik letterlijke citaten spaarzaam. Noem geen namen van reviewers.`;

const CATEGORY_RULES = `Categorieën voor reviews van 1-3 sterren (een review kan in meerdere categorieën vallen):
- Personeel: gedrag, vriendelijkheid, behandeling, service, voorlichting of advies van medewerkers, wachttijd aan de balie.
- Huisregels: ID-controle, toegang, weigering, leeftijdsgrens, regels in de winkel, rookbeleid, aantallen.
- Handel: de producten zelf (kwaliteit, werking, sterkte, edibles, prijs, assortiment, verpakking).
- Overig/onbekend: geen tekst, of niet in te delen.`;

function clip(text: string): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT)}…` : t;
}

async function json(prompt: string): Promise<Record<string, unknown>> {
  const openai = getOpenAiClient();
  if (!openai) throw new Error("AI staat uit: OPENAI_API_KEY of AI_ENABLED=true ontbreekt.");
  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 1200,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Geen tekstantwoord van OpenAI ontvangen.");
  return JSON.parse(raw) as Record<string, unknown>;
}

async function locationTexts(
  loc: WeekReportLocation,
  periodLabel: string,
): Promise<{ narrative: string; categories: Record<string, ReportCategory[]> }> {
  const negative = loc.reviews.filter((r) => r.rating <= 3).slice(0, MAX_NEGATIVE);
  const positive = loc.reviews.filter((r) => r.rating >= 4 && r.text.trim()).slice(0, MAX_POSITIVE);
  if (loc.reviews.length === 0) return { narrative: "", categories: {} };

  const negLines = negative
    .map((r) => `- id=${r.id} [${r.rating}★] ${r.text.trim() ? `"${clip(r.text)}"` : "(geen tekst)"}`)
    .join("\n");
  const posLines = positive.map((r) => `- [${r.rating}★] "${clip(r.text)}"`).join("\n");

  const prompt = `${STYLE}

Locatie: ${loc.name}. Periode: ${periodLabel}.

Reviews van 1-3 sterren:
${negLines || "(geen)"}

Reviews van 4-5 sterren met tekst:
${posLines || "(geen)"}

${CATEGORY_RULES}

Antwoord met exact dit JSON-object:
{
  "categories": { "<id van elke review van 1-3 sterren>": ["Personeel" | "Huisregels" | "Handel" | "Overig/onbekend", ...] },
  "narrative": "..."
}

Voor "narrative" (3-6 zinnen, één alinea, zonder aantallen reviews of categorievermeldingen te noemen — die zet het dashboard er zelf voor):
- Zijn er reviews van 1-3 sterren: beschrijf kort en neutraal wat er gemeld wordt en, als een review meerdere categorieën raakt, waarom (bijvoorbeeld "doordat één review zowel onvriendelijke ontvangst als tegenvallende edibles noemt"). Benoem dat het klantclaims zijn waar dat ertoe doet.
- Dan "Positief: ..." met wat bezoekers in de 4-5 sterrenreviews prijzen.
- Dan "Actie: ..." met één concrete, haalbare actie voor het team.
- Zijn er géén reviews van 1-3 sterren: begin met "Geen negatieve reviews in de beschikbare data." en beschrijf in 1-2 zinnen wat bezoekers waarderen, zonder "Positief:" en "Actie:"; is het aantal reviews klein, zeg dan dat dat voor trends onvoldoende is.
- "Overig/onbekend" alleen als een review in geen enkele andere categorie past.`;

  const out = await json(prompt);
  const categories: Record<string, ReportCategory[]> = {};
  const raw = (out.categories ?? {}) as Record<string, unknown>;
  for (const r of negative) {
    const list = Array.isArray(raw[r.id]) ? (raw[r.id] as unknown[]) : [];
    const valid = [...new Set(list.filter((c): c is ReportCategory => REPORT_CATEGORIES.includes(c as ReportCategory)))];
    // "Overig/onbekend" only when nothing else fits.
    const specific = valid.filter((c) => c !== "Overig/onbekend");
    categories[r.id] = specific.length > 0 ? specific : ["Overig/onbekend"];
  }
  return { narrative: typeof out.narrative === "string" ? out.narrative.trim() : "", categories };
}

export async function generateWeekReport(req: WeekReportRequest): Promise<WeekReportResult> {
  const perLocation = await Promise.all(req.locations.map((loc) => locationTexts(loc, req.periodLabel)));
  const locations: WeekReportResult["locations"] = {};
  req.locations.forEach((loc, i) => {
    locations[loc.id] = perLocation[i];
  });
  return { locations };
}
