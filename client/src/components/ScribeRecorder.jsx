import React, { useRef, useState } from "react";
import { useAuth } from "../AuthContext.jsx";

const CHUNK_MS = 15000;

export default function ScribeRecorder({
  scheduledVisitId,
  isDoctor,
  transcriptChunks,
  suggestions,
  onExtract,
}) {
  const { token } = useAuth();

  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [extracting, setExtracting] = useState(false);

  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const stoppingRef = useRef(false);

  function getSupportedMimeType() {
    const types = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return "";
  }

  async function uploadChunk(blob, mimeType) {
    if (!blob || blob.size === 0) {
      console.warn("Empty audio chunk — skipping upload");
      return;
    }

    let extension = "webm";

    if (mimeType.includes("ogg")) {
      extension = "ogg";
    }

    const formData = new FormData();

    formData.append("audio", blob, `chunk-${Date.now()}.${extension}`);

    try {
      console.log(`Uploading audio chunk: ${blob.size} bytes (${mimeType})`);

      const response = await fetch(
        `/api/scribe/transcribe-chunk/${scheduledVisitId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Transcription request failed (${response.status}): ${text}`,
        );
      }

      console.log("Audio chunk uploaded successfully");
    } catch (err) {
      console.error("Chunk upload failed:", err);
      setError(`Transcription failed: ${err.message}`);
    }
  }

  function createRecorder(stream) {
    const mimeType = getSupportedMimeType();

    let recorder;

    try {
      recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
    } catch (err) {
      console.error("Could not create MediaRecorder:", err);
      throw new Error("This browser does not support audio recording.");
    }

    const actualMimeType = recorder.mimeType || mimeType || "audio/webm";

    const chunks = [];

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    recorder.onstop = async () => {
      const blob = new Blob(chunks, {
        type: actualMimeType,
      });

      console.log(`Recorder stopped. Complete chunk size: ${blob.size} bytes`);

      await uploadChunk(blob, actualMimeType);

      // Start the next complete recording chunk.
      if (!stoppingRef.current && streamRef.current) {
        startRecorderCycle(streamRef.current);
      }
    };

    recorder.onerror = (event) => {
      console.error("MediaRecorder error:", event.error);
      setError("Audio recording error.");
    };

    recorderRef.current = recorder;

    return recorder;
  }

  function startRecorderCycle(stream) {
    if (stoppingRef.current || !streamRef.current) {
      return;
    }

    try {
      const recorder = createRecorder(stream);

      recorder.start();

      console.log(`Started new audio recording (${recorder.mimeType})`);

      recorderRef.current = recorder;

      timerRef.current = setTimeout(() => {
        if (
          recorderRef.current === recorder &&
          recorder.state === "recording" &&
          !stoppingRef.current
        ) {
          console.log("15 seconds reached — closing audio chunk");

          recorder.stop();
        }
      }, CHUNK_MS);
    } catch (err) {
      console.error("Failed to start recorder:", err);
      setError(err.message || "Unable to start audio recording.");
      setRecording(false);
    }
  }

  async function startRecording() {
    setError("");
    stoppingRef.current = false;

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Audio recording is not supported by this browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      stream.getAudioTracks().forEach((track) => {
        console.log("Microphone:", track.label);
      });

      startRecorderCycle(stream);

      setRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);

      if (err.name === "NotAllowedError") {
        setError("Microphone permission was denied.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone was found.");
      } else {
        setError(err.message || "Microphone access denied or unavailable.");
      }

      setRecording(false);
    }
  }

  function stopRecording() {
    stoppingRef.current = true;

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const recorder = recorderRef.current;

    if (recorder && recorder.state === "recording") {
      console.log("Stopping final audio chunk...");
      recorder.stop();
    }

    recorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;
    }

    setRecording(false);
  }

  async function handleExtract() {
    setExtracting(true);

    try {
      await onExtract?.();
    } finally {
      setExtracting(false);
    }
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div
        className="flex justify-between items-center"
        style={{ marginBottom: 4 }}
      >
        <h3 style={{ fontSize: 16 }}>Ambient scribe</h3>

        {recording && (
          <span
            className="flex items-center gap-8 text-sm"
            style={{
              color: "var(--coral)",
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: "var(--coral)",
              }}
            />
            Recording
          </span>
        )}
      </div>

      <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
        Records the conversation in short chunks and transcribes it. Nothing is
        auto-filled — the doctor reviews suggestions before anything is
        confirmed.
      </p>

      {error && <div className="error-box">{error}</div>}

      <div className="flex gap-8" style={{ marginBottom: 14 }}>
        {!recording ? (
          <button className="btn btn-secondary btn-sm" onClick={startRecording}>
            🎙️ Start recording
          </button>
        ) : (
          <button className="btn btn-danger btn-sm" onClick={stopRecording}>
            ⏹ Stop
          </button>
        )}

        {isDoctor && (
          <button
            className="btn btn-primary btn-sm"
            onClick={handleExtract}
            disabled={extracting || transcriptChunks.length === 0}
          >
            {extracting ? "Extracting…" : "Extract suggestions"}
          </button>
        )}
      </div>

      {transcriptChunks.length > 0 && (
        <div style={transcriptBox}>
          {transcriptChunks.map((c) => (
            <p
              key={c.id || c.chunk_index}
              style={{
                fontSize: 12.5,
                margin: "2px 0",
                color: "var(--ink-soft)",
              }}
            >
              {c.text}
            </p>
          ))}
        </div>
      )}

      {suggestions && (
        <div style={suggestionsBox}>
          <div
            className="text-sm"
            style={{
              fontWeight: 700,
              color: "var(--purple)",
              marginBottom: 6,
            }}
          >
            Suggested from conversation — not yet confirmed
          </div>

          {Object.entries(suggestions)
            .filter(([k, v]) => v !== null && k !== "notable_quote")
            .map(([k, v]) => (
              <div
                key={k}
                className="flex justify-between text-sm"
                style={{ padding: "2px 0" }}
              >
                <span className="text-muted">{k.replace(/_/g, " ")}</span>

                <span style={{ fontWeight: 600 }}>{String(v)}</span>
              </div>
            ))}

          {suggestions.notable_quote && (
            <p
              className="text-muted text-sm"
              style={{
                fontStyle: "italic",
                marginTop: 6,
              }}
            >
              "{suggestions.notable_quote}"
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const transcriptBox = {
  maxHeight: 120,
  overflowY: "auto",
  padding: 10,
  background: "var(--paper)",
  borderRadius: 10,
  border: "1px solid var(--line-soft)",
};

const suggestionsBox = {
  marginTop: 12,
  padding: 12,
  background: "var(--purple-light)",
  borderRadius: 10,
};
