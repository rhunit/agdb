import OpenAI from "openai";

// Shared by every feature that calls out to OpenAI (the Rapportage
// narrative summary, the floating AI chat panel) — one client, one env
// var to configure, so there's a single place that knows whether OpenAI
// is set up at all.

let client: OpenAI | null = null;

export function getOpenAiClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
