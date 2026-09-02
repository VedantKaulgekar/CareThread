const Groq = require("groq-sdk");

let client = null;

function getClient() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY is not set. Get a free key at https://console.groq.com/keys and add it to server/.env",
    );
  }

  if (!client) {
    client = new Groq({
      apiKey: process.env.GROQ_API_KEY,
    });
  }

  return client;
}

const DEFAULT_MODEL = "openai/gpt-oss-120b";

/**
 * Normal text completion.
 */
async function complete({
  system,
  prompt,
  model = DEFAULT_MODEL,
  temperature = 0.3,
  maxTokens = 1000,
  reasoningEffort = "low",
}) {
  const groq = getClient();

  const messages = [];

  if (system) {
    messages.push({
      role: "system",
      content: system,
    });
  }

  messages.push({
    role: "user",
    content: prompt,
  });

  const response = await groq.chat.completions.create({
    model,
    messages,
    temperature,
    max_completion_tokens: maxTokens,
    reasoning_effort: reasoningEffort,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

/**
 * JSON completion.
 *
 * If a JSON schema is provided, use Groq Structured Outputs
 * with strict schema validation.
 *
 * If no schema is provided, fall back to JSON Object Mode.
 */
async function completeJSON({
  system,
  prompt,
  model = DEFAULT_MODEL,
  temperature = 0.2,
  maxTokens = 500,
  schema,
  schemaName = "response",
  reasoningEffort = "low",
}) {
  const groq = getClient();

  const messages = [];

  if (system) {
    messages.push({
      role: "system",
      content: system,
    });
  }

  messages.push({
    role: "user",
    content: prompt,
  });

  const responseFormat = schema
    ? {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          strict: true,
          schema,
        },
      }
    : {
        type: "json_object",
      };

  const response = await groq.chat.completions.create({
    model,
    messages,

    temperature,

    // GPT-OSS is a reasoning model, so give it enough
    // completion space for reasoning + final JSON.
    max_completion_tokens: maxTokens,

    // Keep reasoning small for simple classification tasks.
    reasoning_effort: reasoningEffort,

    // Do not return the model's internal reasoning to the application.
    reasoning_format: "hidden",

    response_format: responseFormat,
  });

  const text = response.choices[0]?.message?.content?.trim() || "{}";

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error("Groq returned invalid JSON:", text);

    throw new Error("Groq returned invalid JSON.");
  }
}

module.exports = {
  getClient,
  complete,
  completeJSON,
  DEFAULT_MODEL,
};
