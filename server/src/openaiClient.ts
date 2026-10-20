import OpenAI from "openai";

// Shared by every feature that calls out to OpenAI (the Rapportage
// narrative summary, the floating AI chat panel) — one client, one env
// var to configure, so there's a single place that knows whether OpenAI
// is set up at all.

let client: OpenAI | null = null;

// Explicit opt-in on top of the key: a key can be set while the OpenAI
// account itself isn't usable yet (no credits), and the panels should
// then show "Binnenkort beschikbaar" rather than OpenAI's raw error.
// Flip AI_ENABLED=true on the deployment once a test call works.
function isAiEnabled(): boolean {
  return process.env.AI_ENABLED === "true";
}

export function getOpenAiClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || !isAiEnabled()) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY) && isAiEnabled();
}
