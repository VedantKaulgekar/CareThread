/**
 * Thin wrapper around Groq's API — free tier, no credit card, serves
 * open-weight models (OpenAI's open-weight gpt-oss-120b by default) at
 * very low latency. API is OpenAI-compatible, so the official
 * `groq-sdk` client mirrors the OpenAI SDK shape almost exactly.
 *
 * Requires GROQ_API_KEY in server/.env (free key from console.groq.com).
 *
 * Note: Groq deprecates/retires models over time. If DEFAULT_MODEL
 * below ever starts returning a "model_not_found" error, check
 * https://console.groq.com/docs/models for the current list and
 * update it — or override per-call by passing `model` to complete()/
 * completeJSON() without touching this file.
 */

const Groq = require("groq-sdk");

let client = null;

function getClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not set. Get a free key at https://console.groq.com/keys and add it to server/.env",
    );
  }
  if (!client) {
    client = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return client;
}

const DEFAULT_MODEL = "openai/gpt-oss-120b";

/**
 * Runs a single-turn completion and returns the raw text response.
 */
async function complete({ system, prompt, model = DEFAULT_MODEL, temperature = 0.3, maxTokens = 1000 }) {
  const groq = getClient();

  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const response = await groq.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

/**
 * Same as complete(), but instructs the model to return valid JSON matching
 * the given shape description, and parses the result. Throws if the model's
 * output isn't valid JSON so callers can fall back gracefully.
 */
async function completeJSON({ system, prompt, model = DEFAULT_MODEL, temperature = 0.2, maxTokens = 1000 }) {
  const groq = getClient();

  const messages = [];
  if (system) messages.push({ role: "system", content: system });
  messages.push({ role: "user", content: prompt });

  const response = await groq.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    response_format: { type: "json_object" },
  });

  const text = response.choices[0]?.message?.content?.trim() || "{}";
  return JSON.parse(text);
}

module.exports = { getClient, complete, completeJSON, DEFAULT_MODEL };
