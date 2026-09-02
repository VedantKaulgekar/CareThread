const { v4: uuidv4 } = require("uuid");
const { toFile } = require("groq-sdk");

const db = require("../db");
const { getClient, completeJSON } = require("./groqClient");

const TRANSCRIBE_MODEL = "whisper-large-v3-turbo";

async function transcribeChunk({
  scheduledVisitId,
  audioBuffer,
  filename,
  speakerRole,
}) {
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error("Received empty audio buffer");
  }

  console.log(`Audio buffer size: ${audioBuffer.length} bytes`);

  console.log(`Audio filename: ${filename || "chunk.webm"}`);

  const groq = getClient();

  const safeFilename = filename || "chunk.webm";

  const file = await toFile(audioBuffer, safeFilename);

  let response;

  try {
    console.log(`Sending complete audio file to Groq: ${safeFilename}`);

    response = await groq.audio.transcriptions.create({
      model: TRANSCRIBE_MODEL,
      file,
      response_format: "json",
      temperature: 0,
    });
  } catch (error) {
    console.error("Groq transcription failed:", error);

    throw error;
  }

  const text = (response.text || "").trim();

  if (!text) {
    console.log("Groq returned an empty transcription.");

    return null;
  }

  const countResult = await db.query(
    `
    SELECT COUNT(*)
    FROM visit_transcript_chunks
    WHERE scheduled_visit_id = $1
    `,
    [scheduledVisitId],
  );

  const nextIndex = Number(countResult.rows[0].count);

  const id = uuidv4();

  await db.query(
    `
    INSERT INTO visit_transcript_chunks
      (
        id,
        scheduled_visit_id,
        speaker_role,
        text,
        chunk_index
      )
    VALUES
      ($1, $2, $3, $4, $5)
    `,
    [id, scheduledVisitId, speakerRole || "unknown", text, nextIndex],
  );

  console.log(`Transcript chunk stored: ${nextIndex}`);

  return {
    id,
    text,
    chunk_index: nextIndex,
  };
}

const EXTRACTION_SYSTEM_PROMPT = `
You listen to a transcript of a clinical trial visit
conversation and extract ONLY values that were
explicitly stated out loud.

Rules:

- Only extract a field if a specific number or value
  was actually spoken.
- Never infer, estimate, or guess a value that wasn't said.
- If nothing relevant was said, return empty/null
  for that field.
- Return strict JSON matching this shape exactly:

{
  "temperature": number or null,
  "bp_systolic": number or null,
  "bp_diastolic": number or null,
  "sugar": number or null,
  "spo2": number or null,
  "heart_rate": number or null,
  "dosage_mentioned": string or null,
  "notable_quote": string or null
}

"notable_quote" should be the exact short phrase
that supports your extraction, or null if nothing
was extracted.
`;

async function extractSuggestions(scheduledVisitId) {
  const chunksResult = await db.query(
    `
    SELECT text
    FROM visit_transcript_chunks
    WHERE scheduled_visit_id = $1
    ORDER BY chunk_index ASC
    `,
    [scheduledVisitId],
  );

  const transcript = chunksResult.rows.map((row) => row.text).join(" ");

  if (!transcript.trim()) {
    return null;
  }

  const suggestions = await completeJSON({
    system: EXTRACTION_SYSTEM_PROMPT,

    prompt: `
Transcript so far:

${transcript}

Extract now.
`,

    temperature: 0.1,
    maxTokens: 400,
  });

  await db.query(
    `
    UPDATE scheduled_visits
    SET scribe_suggestions = $1
    WHERE id = $2
    `,
    [JSON.stringify(suggestions), scheduledVisitId],
  );

  return suggestions;
}

module.exports = {
  transcribeChunk,
  extractSuggestions,
};
