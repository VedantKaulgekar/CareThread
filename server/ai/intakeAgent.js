/**
 * Intake Agent — CareThread
 *
 * Classifies a patient's free-text concern as:
 *
 *   low
 *   medium
 *   high
 *   unclear
 *
 * The agent does NOT diagnose, prescribe, or provide medical advice.
 *
 * It uses Groq Structured Outputs so the response always follows
 * the expected JSON schema.
 */

const { completeJSON } = require("./groqClient");

const SYSTEM_PROMPT = `You are the CareThread patient-intake urgency classifier.

Your ONLY task is to classify the urgency of a patient's message during a clinical drug trial.

You do NOT diagnose.
You do NOT prescribe.
You do NOT recommend treatment.
You do NOT give medical advice.

Classify the patient's message into exactly one of these categories:

HIGH:
Use high when the patient describes severe, serious, rapidly worsening, emergency, or potentially dangerous symptoms.

Also treat explicit urgent language as a strong signal of high urgency when the patient clearly asks for immediate or urgent help, for example:
- "I need help urgently"
- "This is an emergency"
- "I need help immediately"
- "Please help me right now"

MEDIUM:
Use medium when the patient describes a genuine health concern that should receive the doctor's attention soon but does not appear immediately dangerous.

LOW:
Use low for mild symptoms, minor questions, or mild/expected effects.

UNCLEAR:
Use unclear only when the message does not provide enough information to determine urgency and does not contain a clear urgent or emergency signal.

Important:
- Do not diagnose the patient.
- Do not recommend what the patient should do.
- Do not provide medical advice.
- Base the classification only on the patient's message.
- Give one short reasoning sentence.
- Confidence must be between 0 and 1.
- If confidence is below 0.6, use "unclear" unless the message contains an explicit urgent/emergency signal.`;

const CONFIDENCE_THRESHOLD = 0.6;

async function classifyConcern(concernText) {
  const text = String(concernText || "").trim();

  if (!text) {
    return {
      urgency: "unclear",
      reasoning: "No patient message was provided.",
      confidence: 1,
    };
  }

  const result = await completeJSON({
    system: SYSTEM_PROMPT,

    prompt: `Classify this patient message:

"${text}"`,

    temperature: 0.1,

    // Enough space for GPT-OSS reasoning + final structured JSON.
    maxTokens: 500,

    // Keep reasoning effort low because this is a simple
    // four-category classification task.
    reasoningEffort: "low",

    schema: {
      type: "object",

      properties: {
        urgency: {
          type: "string",
          enum: ["low", "medium", "high", "unclear"],
        },

        reasoning: {
          type: "string",
        },

        confidence: {
          type: "number",
          minimum: 0,
          maximum: 1,
        },
      },

      required: ["urgency", "reasoning", "confidence"],

      additionalProperties: false,
    },

    schemaName: "intake_classification",
  });

  const confidence =
    typeof result.confidence === "number"
      ? Math.max(0, Math.min(1, result.confidence))
      : 0;

  const explicitUrgentLanguage =
    /\b(urgent|urgently|emergency|immediately|right now|asap|critical|severe)\b/i.test(
      text,
    );

  let urgency = ["low", "medium", "high", "unclear"].includes(result.urgency)
    ? result.urgency
    : "unclear";

  /*
   * Confidence rule:
   *
   * Normally, confidence below 0.6 becomes "unclear".
   *
   * However, an explicit urgent/emergency request is preserved
   * as high urgency because the patient has clearly indicated
   * that they need immediate attention.
   */
  if (confidence < CONFIDENCE_THRESHOLD) {
    urgency = explicitUrgentLanguage ? "high" : "unclear";
  }

  /*
   * If the model itself identified an explicit urgent signal
   * as high, keep it high even if confidence is close to the
   * threshold.
   */
  if (explicitUrgentLanguage && urgency === "unclear") {
    urgency = "high";
  }

  return {
    urgency,

    reasoning: typeof result.reasoning === "string" ? result.reasoning : "",

    confidence,
  };
}

module.exports = {
  classifyConcern,
  CONFIDENCE_THRESHOLD,
};
