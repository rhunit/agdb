import OpenAI from "openai";

// Only generated on demand (see the "Genereer samenvatting" button on the
// Rapportage page) — this calls out to the OpenAI API, which costs money
// and takes a few seconds, so it never runs automatically on page load or
// on every filter change.

export interface ReportSummaryReviewInput {
  reviewer: string;
  rating: number;
  text: string;
  createTime: string | null;
}

export interface ReportSummaryRequest {
  locationName: string;
  periodLabel: string;
  reviews: ReportSummaryReviewInput[];
}

export interface ReportSummaryResult {
  compliments: string;
  concerns: string;
  closing: string;
}

// Caps the prompt to a sane size/cost regardless of how large a period
// someone picks — a representative sample is enough for a narrative
// summary, this isn't a statistical computation.
const MAX_REVIEWS_IN_PROMPT = 150;

const MODEL = "gpt-4o-mini";

let client: OpenAI | null = null;

function getClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

export function isReportSummaryAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function generateReportSummary(
  req: ReportSummaryRequest,
): Promise<ReportSummaryResult> {
  const openai = getClient();
  if (!openai) {
    throw new Error("OPENAI_API_KEY is niet geconfigureerd.");
  }

  const reviews = req.reviews.slice(0, MAX_REVIEWS_IN_PROMPT);
  const reviewLines = reviews
    .map((r, i) => {
      const date = r.createTime ? r.createTime.slice(0, 10) : "onbekende datum";
      const safeText = r.text.replace(/"/g, "'");
      return `${i + 1}. [${r.rating}★, ${date}] ${r.reviewer}: "${safeText}"`;
    })
    .join("\n");

  const prompt = `Je schrijft een kort, feitelijk Nederlands verslag-fragment voor een managementrapportage over Google-reviews van "${req.locationName}", periode: ${req.periodLabel}.

Hieronder staan de reviews uit deze periode voor deze locatie (genummerd, met sterren, datum, naam en tekst):
${reviewLines || "(geen reviews in deze periode)"}

Schrijf UITSLUITEND op basis van de tekst hierboven. Verzin geen namen, gebeurtenissen of details die niet letterlijk in de reviews staan. Als een medewerker met naam genoemd wordt in een review, mag je die naam noemen. Citeer waar passend een kort fragment letterlijk tussen aanhalingstekens.

Antwoord met exact dit JSON-object, geen andere tekst en geen markdown-opmaak eromheen:
{
  "compliments": "2-4 zinnen over wat bezoekers positief noemen, inclusief naam-vermeldingen van medewerkers als die voorkomen in de reviews. Lege string als er geen reviews zijn.",
  "concerns": "2-4 zinnen over terugkerende kritiekpunten uit reviews van 1-3 sterren, neutrale toon, geen beschuldigingen. Lege string als er geen kritische reviews zijn.",
  "closing": "1-2 zinnen afsluitende duiding voor het management voor de komende periode."
}`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 700,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [{ role: "user", content: prompt }],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Geen tekstantwoord van OpenAI ontvangen.");
  }

  let parsed: Partial<ReportSummaryResult>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Kon het antwoord van OpenAI niet verwerken.");
  }

  return {
    compliments: typeof parsed.compliments === "string" ? parsed.compliments : "",
    concerns: typeof parsed.concerns === "string" ? parsed.concerns : "",
    closing: typeof parsed.closing === "string" ? parsed.closing : "",
  };
}
