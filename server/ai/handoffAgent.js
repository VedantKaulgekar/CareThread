const { complete } = require("./groqClient");

const SYSTEM_PROMPT = `You write short, plain-language after-visit summaries for patients in a clinical drug trial.

Rules you must follow strictly:
- Only restate facts that are explicitly present in the data given to you (readings, dosage, notes).
- Never add a diagnosis, medical opinion, risk assessment, or recommendation of your own.
- Never speculate about what a reading "means" clinically.
- Write 3-5 short sentences, in a warm but plain tone, addressed directly to the patient ("you").
- If a stage has no data at all, simply don't mention that stage.`;

function buildPrompt({ workspaceTitle, drugName, vitalsRows }) {
  const stageLines = vitalsRows
    .map((v) => {
      const readings = [
        v.temperature != null && `temperature ${v.temperature}°F`,
        v.bp_systolic != null &&
          v.bp_diastolic != null &&
          `blood pressure ${v.bp_systolic}/${v.bp_diastolic}`,
        v.sugar != null && `blood sugar ${v.sugar} mg/dL`,
        v.spo2 != null && `SpO2 ${v.spo2}%`,
        v.heart_rate != null && `heart rate ${v.heart_rate} bpm`,
      ]
        .filter(Boolean)
        .join(", ");

      const parts = [
        `Stage: ${v.stage}`,
        readings && `Patient-reported readings: ${readings}`,
        v.dosage_given && `Dosage given: ${v.dosage_given}`,
        v.doctor_notes && `Doctor notes: ${v.doctor_notes}`,
      ].filter(Boolean);

      return parts.join(" | ");
    })
    .join("\n");

  return `Trial: ${workspaceTitle} (${drugName})

Data recorded during this visit:
${stageLines || "No data was recorded during this visit."}

Write the after-visit summary now.`;
}

async function generateVisitSummary({ workspaceTitle, drugName, vitalsRows }) {
  if (!vitalsRows || vitalsRows.length === 0) {
    return "No vitals were recorded during this visit.";
  }

  const prompt = buildPrompt({ workspaceTitle, drugName, vitalsRows });

  return complete({
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0.4,
    maxTokens: 300,
  });
}

module.exports = { generateVisitSummary };
