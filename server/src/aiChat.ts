import { getOpenAiClient, isOpenAiConfigured } from "./openaiClient.js";

// The floating "AI"-paneel on the dashboard — a general-purpose chat
// assistant someone can keep open while replying to reviews, so they
// don't need a separate ChatGPT tab/login. Not grounded in any review
// data; it's a plain conversational assistant, same OPENAI_API_KEY as
// the Rapportage summary.

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// Keeps a runaway conversation (or a crafted request) from ballooning
// token cost — older turns just fall out of context rather than erroring.
const MAX_HISTORY_MESSAGES = 30;
const MAX_MESSAGE_LENGTH = 4000;

const MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT =
  "Je bent een behulpzame Nederlandstalige AI-assistent, beschikbaar als los hulpmiddel naast een dashboard voor het beheren van Google-reviews van coffeeshops (Amsterdam Genetics). Je hebt geen toegang tot de reviewdata zelf — als iemand vraagt naar specifieke reviews of cijfers uit het dashboard, leg dan uit dat je dat niet kunt inzien en dat ze dat zelf moeten overnemen uit het dashboard. Antwoord kort en praktisch.";

export function isAiChatAvailable(): boolean {
  return isOpenAiConfigured();
}

export async function generateChatReply(history: ChatMessage[]): Promise<string> {
  const openai = getOpenAiClient();
  if (!openai) {
    throw new Error("OPENAI_API_KEY is niet geconfigureerd.");
  }

  const trimmed = history.slice(-MAX_HISTORY_MESSAGES).map((m) => ({
    role: m.role,
    content: m.content.slice(0, MAX_MESSAGE_LENGTH),
  }));

  const completion = await openai.chat.completions.create({
    model: MODEL,
    max_tokens: 800,
    temperature: 0.6,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...trimmed],
  });

  const reply = completion.choices[0]?.message?.content;
  if (!reply) {
    throw new Error("Geen antwoord van OpenAI ontvangen.");
  }
  return reply;
}
