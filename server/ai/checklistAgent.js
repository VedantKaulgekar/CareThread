/**
 * Live Visit Checklist Agent — Feature 2 from the CareThread solution
 * design. The LLM step only runs once, at workspace setup, to turn a
 * doctor's plain-text protocol description into a structured checklist.
 * Enforcement during the live visit itself is pure state-machine logic
 * (see the checklist-progress routes in index.js) — no LLM in the loop
 * during the actual call.
 */

const { completeJSON } = require("./groqClient");

const SYSTEM_PROMPT = `You convert a clinical trial visit protocol, written in plain language by a doctor, into a structured checklist.

Rules:
- Extract concrete, checkable action items only — things an investigator would tick off during a visit.
- Group items into exactly these three stages: "pre_dosage", "post_dosage", "general".
- If the protocol doesn't mention a stage at all, return an empty array for it.
- Keep each item short (a few words), like a checklist label, not a sentence.
- Do not invent items that aren't implied by the protocol text.

Return strict JSON in this shape:
{
  "pre_dosage": ["item 1", "item 2"],
  "post_dosage": ["item 1"],
  "general": []
}`;

async function generateChecklist(protocolText) {
  if (!protocolText || !protocolText.trim()) {
    return { pre_dosage: [], post_dosage: [], general: [] };
  }

  const checklist = await completeJSON({
    system: SYSTEM_PROMPT,
    prompt: `Protocol:\n\n${protocolText}\n\nGenerate the checklist now.`,
    temperature: 0.2,
    maxTokens: 500,
  });

  // Defensive normalization in case the model omits a key.
  return {
    pre_dosage: Array.isArray(checklist.pre_dosage) ? checklist.pre_dosage : [],
    post_dosage: Array.isArray(checklist.post_dosage) ? checklist.post_dosage : [],
    general: Array.isArray(checklist.general) ? checklist.general : [],
  };
}

/**
 * Given a checklist definition and a progress object, returns the list
 * of required items not yet confirmed (empty array = fully complete).
 */
function getIncompleteItems(checklist, progress) {
  const incomplete = [];
  for (const stage of ["pre_dosage", "post_dosage", "general"]) {
    const items = checklist?.[stage] || [];
    for (const item of items) {
      if (!progress?.[stage]?.[item]) {
        incomplete.push({ stage, item });
      }
    }
  }
  return incomplete;
}

module.exports = { generateChecklist, getIncompleteItems };
