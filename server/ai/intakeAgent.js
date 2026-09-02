/**
 * Intake Agent — Feature 1 from the CareThread solution design, adapted
 * to fit CareThread's actual architecture.
 *
 * The original design assumed routing to one of several specialists.
 * In CareThread, a workspace already has exactly one doctor tied to one
 * drug trial, so "routing to the right specialist" doesn't apply the
 * same way. What still applies, and still matters: a patient between
 * scheduled visits can describe a concern, and the system should
 * classify how urgent it is — low/medium/high — rather than making the
 * patient guess whether it's worth flagging, and rather than making the
 * doctor manually triage every message with equal priority.
 *
 * Uses the same AMIE-inspired confidence pattern as the rest of
 * CareThread: below a confidence threshold, it returns "unclear"
 * instead of guessing, so a human reviews it rather than the system
 * silently mis-triaging something serious.
 */

const { completeJSON } = require("./groqClient");

const SYSTEM_PROMPT = `You triage a patient's free-text message about how they're feeling during a clinical drug trial, between their scheduled visits.

You classify urgency only. You never diagnose, never suggest a remedy, never offer medical advice.

Urgency levels:
- "high": symptoms suggesting a need for prompt medical attention (e.g. severe or worsening symptoms, anything suggesting a serious reaction)
- "medium": a real concern worth the doctor's attention soon, but not urgent
- "low": a minor question, or reporting a mild/expected effect
- "unclear": you cannot confidently classify this from the text alone

Return strict JSON:
{
  "urgency": "high" | "medium" | "low" | "unclear",
  "reasoning": "one short sentence explaining why, quoting or paraphrasing the specific thing that drove the classification",
  "confidence": number between 0 and 1
}

If your confidence would be below 0.6, return "unclear" as the urgency instead of guessing.`;

const CONFIDENCE_THRESHOLD = 0.6;

async function classifyConcern(concernText) {
  const result = await completeJSON({
    system: SYSTEM_PROMPT,
    prompt: `Patient message:\n\n"${concernText}"\n\nClassify now.`,
    temperature: 0.2,
    maxTokens: 200,
  });

  const confidence = typeof result.confidence === "number" ? result.confidence : 0;
  const urgency = confidence >= CONFIDENCE_THRESHOLD ? result.urgency : "unclear";

  return {
    urgency: ["low", "medium", "high", "unclear"].includes(urgency) ? urgency : "unclear",
    reasoning: result.reasoning || "",
    confidence,
  };
}

module.exports = { classifyConcern, CONFIDENCE_THRESHOLD };
