import { getOpenAiClient, isOpenAiConfigured } from "./openaiClient.js";

// The floating "AI"-paneel on the dashboard — a general-purpose chat
// assistant someone can keep open while replying to reviews, so they
// don't need a separate ChatGPT tab/login. Same OPENAI_API_KEY as the
// Rapportage summary. Grounded in the aggregate dashboard stats the
// frontend sends along with each message (see `context` below) — never
// individual review text, that stays out of the prompt.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Keeps a runaway conversation (or a crafted request) from ballooning
// token cost — older turns just fall out of context rather than erroring.
const MAX_HISTORY_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 4000;
const MAX_CONTEXT_LENGTH = 2000;

const MODEL = "gpt-4o-mini";

const BASE_SYSTEM_PROMPT =
  "Je bent een behulpzame Nederlandstalige AI-assistent, beschikbaar als los hulpmiddel naast een dashboard voor het beheren van Google-reviews van coffeeshops (Amsterdam Genetics). Antwoord kort en praktisch.";

export function isAiChatAvailable(): boolean {
  return isOpenAiConfigured();
}

/** `context` is a short plain-text snapshot of the aggregate stats
 * currently on screen (see app/src/lib/aiChatContext.ts) — optional,
 * since the panel can also be used as a plain assistant without it. */
export async function generateChatReply(
  history: ChatMessage[],
  context?: string,
): Promise<string> {
  const openai = getOpenAiClient();
  if (!openai) {
    throw new Error("OPENAI_API_KEY is niet geconfigureerd.");
  }

  const trimmed = history.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
    role: m.role,
    content: m.content.slice(0, MAX_MESSAGE_LENGTH),
  }));

  const systemPrompt = context
    ? `${BASE_SYSTEM_PROMPT}\n\nDit zijn de actuele cijfers die nu op het dashboard te zien zijn — gebruik deze om vragen over reviewaantallen, scores of periodes te beantwoorden:\n${context.slice(0, MAX_CONTEXT_LENGTH)}\n\nJe hebt geen toegang tot losse reviewteksten of -namen, alleen deze cijfers. Als iets daarbuiten wordt gevraagd, leg dat uit in plaats van te gokken.`
    : `${BASE_SYSTEM_PROMPT} Je hebt geen toegang tot de reviewdata zelf — als iemand vraagt naar specifieke reviews of cijfers uit het dashboard, leg dan uit dat je dat niet kunt inzien.`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 800,
    temperature: 0.6,
    messages: [{ role: "system", content: systemPrompt }, ...trimmed],
  });

  const reply = completion.choices[0]?.message?.content;
  if (!reply) {
    throw new Error("Geen antwoord van OpenAI ontvangen.");
  }
  return reply;
}
