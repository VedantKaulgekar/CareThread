/**
 * Anomaly Detection Agent — Feature 4 from the CareThread solution design.
 *
 * Pure statistics, deliberately no LLM involved: checks a newly submitted
 * reading against (a) medically plausible absolute ranges and (b) the
 * patient's own historical readings for that same parameter in this
 * workspace. Never diagnoses — only flags "this looks inconsistent,
 * please re-verify," the same way a nurse would notice a surprising
 * reading and double-check it.
 */

const db = require("../db");

// Conservative plausible-range bounds. These exist purely to catch
// obvious entry errors (e.g. a misplaced decimal), not to make any
// clinical judgment about what's healthy.
const PLAUSIBLE_RANGES = {
  temperature: { min: 90, max: 108, unit: "°F" },
  bp_systolic: { min: 60, max: 220, unit: "mmHg" },
  bp_diastolic: { min: 30, max: 140, unit: "mmHg" },
  sugar: { min: 20, max: 500, unit: "mg/dL" },
  spo2: { min: 60, max: 100, unit: "%" },
  heart_rate: { min: 30, max: 220, unit: "bpm" },
};

const Z_SCORE_THRESHOLD = 2.5;
const MIN_HISTORY_FOR_ZSCORE = 3;

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr, avg) {
  if (arr.length < 2) return 0;
  const variance = arr.reduce((sum, v) => sum + (v - avg) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(variance);
}

/**
 * Given a newly submitted value and the patient's past values for that
 * same field (in this workspace), returns a flag object or null.
 */
function checkField(field, value, pastValues) {
  if (value === null || value === undefined) return null;

  const range = PLAUSIBLE_RANGES[field];
  if (range && (value < range.min || value > range.max)) {
    return {
      field,
      reason: `${value}${range.unit} is outside the plausible range (${range.min}-${range.max}${range.unit})`,
      type: "range",
    };
  }

  const history = pastValues.filter((v) => v !== null && v !== undefined);
  if (history.length >= MIN_HISTORY_FOR_ZSCORE) {
    const avg = mean(history);
    const sd = stdDev(history, avg);
    if (sd > 0) {
      const z = Math.abs((value - avg) / sd);
      if (z >= Z_SCORE_THRESHOLD) {
        return {
          field,
          reason: `${value} is ${z.toFixed(1)} standard deviations from this patient's own average (${avg.toFixed(1)}) over their last ${history.length} readings`,
          type: "history",
          z_score: +z.toFixed(2),
        };
      }
    }
  }

  return null;
}

/**
 * Checks a full vitals submission against the patient's history in this
 * workspace and returns an array of flags (empty if nothing looks off).
 */
async function checkVitalsSubmission({ patientId, workspaceId, currentVisitId, reading }) {
  const historyResult = await db.query(
    `
    SELECT temperature, bp_systolic, bp_diastolic, sugar, spo2, heart_rate
    FROM vitals
    WHERE patient_id = $1 AND workspace_id = $2 AND scheduled_visit_id != $3
    ORDER BY patient_submitted_at DESC
    LIMIT 20
    `,
    [patientId, workspaceId, currentVisitId],
  );

  const rows = historyResult.rows;
  const fields = ["temperature", "bp_systolic", "bp_diastolic", "sugar", "spo2", "heart_rate"];

  const flags = [];
  for (const field of fields) {
    const pastValues = rows.map((r) => r[field]);
    const flag = checkField(field, reading[field], pastValues);
    if (flag) flags.push(flag);
  }

  return flags;
}

module.exports = { checkVitalsSubmission, checkField, PLAUSIBLE_RANGES };
