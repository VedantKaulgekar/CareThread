import React, { useState } from "react";
import { api, useAuth } from "../AuthContext.jsx";

const STAGE_LABELS = {
  pre_dosage: "Pre-dosage",
  post_dosage: "Post-dosage",
  general: "General",
};
const STAGES = ["pre_dosage", "post_dosage", "general"];

function emptyChecklist() {
  return { pre_dosage: [], post_dosage: [], general: [] };
}

export default function ProtocolCard({ workspace, onUpdated }) {
  const { token } = useAuth();
  const [expanded, setExpanded] = useState(!workspace.checklist);
  const [text, setText] = useState(workspace.protocol_text || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [manualEditing, setManualEditing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [draftAdd, setDraftAdd] = useState({
    pre_dosage: "",
    post_dosage: "",
    general: "",
  });
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [checklistError, setChecklistError] = useState("");

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await api(`/workspaces/${workspace.id}/protocol`, {
        method: "PUT",
        token,
        body: { protocol_text: text },
      });
      onUpdated?.(data.workspace);
      setExpanded(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function startManualEdit() {
    const base = workspace.checklist || emptyChecklist();
    setDraft({
      pre_dosage: [...(base.pre_dosage || [])],
      post_dosage: [...(base.post_dosage || [])],
      general: [...(base.general || [])],
    });
    setChecklistError("");
    setManualEditing(true);
  }

  function updateItem(stage, idx, value) {
    setDraft((d) => ({
      ...d,
      [stage]: d[stage].map((it, i) => (i === idx ? value : it)),
    }));
  }

  function removeItem(stage, idx) {
    setDraft((d) => ({ ...d, [stage]: d[stage].filter((_, i) => i !== idx) }));
  }

  function addItem(stage) {
    const value = draftAdd[stage].trim();
    if (!value) return;
    setDraft((d) => ({ ...d, [stage]: [...d[stage], value] }));
    setDraftAdd((a) => ({ ...a, [stage]: "" }));
  }

  async function handleSaveChecklist() {
    setSavingChecklist(true);
    setChecklistError("");
    try {
      const data = await api(`/workspaces/${workspace.id}/checklist`, {
        method: "PUT",
        token,
        body: { checklist: draft },
      });
      onUpdated?.(data.workspace);
      setManualEditing(false);
    } catch (err) {
      setChecklistError(err.message);
    } finally {
      setSavingChecklist(false);
    }
  }

  const checklist = workspace.checklist;
  const itemCount = checklist
    ? (checklist.pre_dosage?.length || 0) +
      (checklist.post_dosage?.length || 0) +
      (checklist.general?.length || 0)
    : 0;

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20 }}>
      <div className="flex justify-between items-center">
        <div>
          <h3 style={{ fontSize: 16, marginBottom: 2 }}>
            Visit protocol &amp; checklist
          </h3>
          <p className="text-muted text-sm">
            {itemCount > 0
              ? `${itemCount} checklist item${itemCount > 1 ? "s" : ""} — enforced during every visit.`
              : "No protocol set yet — visits in this workspace have no enforced checklist."}
          </p>
        </div>
        <div className="flex gap-8">
          {!manualEditing && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={startManualEdit}
            >
              {itemCount > 0 ? "Edit items" : "Add items manually"}
            </button>
          )}
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setManualEditing(false);
              setExpanded((e) => !e);
            }}
          >
            {expanded ? "Cancel" : "Generate from protocol (AI)"}
          </button>
        </div>
      </div>

      {expanded && !manualEditing && (
        <form onSubmit={handleSave} style={{ marginTop: 14 }}>
          {error && <div className="error-box">{error}</div>}
          <textarea
            required
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Describe the visit protocol in plain language, e.g. 'Check temperature and blood pressure before dosage. Confirm dosage given. After dosage, recheck temperature and blood pressure.'"
            style={{
              width: "100%",
              padding: "11px 14px",
              borderRadius: 9,
              border: "1.5px solid var(--line)",
              marginBottom: 10,
            }}
          />
          <button
            className="btn btn-primary btn-sm"
            disabled={saving || !text.trim()}
          >
            {saving ? "Generating checklist…" : "Save & generate checklist"}
          </button>
          <p className="text-muted text-sm mt-8">
            This replaces the checklist below with a freshly AI-generated one.
          </p>
        </form>
      )}

      {manualEditing && draft && (
        <div style={{ marginTop: 14 }}>
          {checklistError && <div className="error-box">{checklistError}</div>}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 16,
            }}
          >
            {STAGES.map((stage) => (
              <div key={stage}>
                <div
                  className="text-sm"
                  style={{ fontWeight: 700, marginBottom: 8 }}
                >
                  {STAGE_LABELS[stage]}
                </div>
                {draft[stage].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-6"
                    style={{ marginBottom: 6 }}
                  >
                    <input
                      value={item}
                      onChange={(e) => updateItem(stage, idx, e.target.value)}
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "1px solid var(--line-soft)",
                        fontSize: 13,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(stage, idx)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#dc2626",
                        cursor: "pointer",
                        fontSize: 14,
                        padding: "0 2px",
                      }}
                      aria-label="Remove item"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <div className="flex items-center gap-6">
                  <input
                    value={draftAdd[stage]}
                    onChange={(e) =>
                      setDraftAdd((a) => ({ ...a, [stage]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addItem(stage);
                      }
                    }}
                    placeholder="Add item…"
                    style={{
                      flex: 1,
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "1px dashed var(--line-soft)",
                      fontSize: 13,
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => addItem(stage)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--purple)",
                      cursor: "pointer",
                      fontSize: 15,
                      padding: "0 2px",
                    }}
                    aria-label="Add item"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-8" style={{ marginTop: 16 }}>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSaveChecklist}
              disabled={savingChecklist}
            >
              {savingChecklist ? "Saving…" : "Save checklist"}
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setManualEditing(false)}
              disabled={savingChecklist}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!expanded && !manualEditing && checklist && itemCount > 0 && (
        <div
          style={{
            marginTop: 14,
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 12,
          }}
        >
          {STAGES.map(
            (stage) =>
              checklist[stage]?.length > 0 && (
                <div key={stage}>
                  <div
                    className="text-sm"
                    style={{ fontWeight: 700, marginBottom: 4 }}
                  >
                    {STAGE_LABELS[stage]}
                  </div>
                  {checklist[stage].map((item, i) => (
                    <div key={i} className="text-muted text-sm">
                      • {item}
                    </div>
                  ))}
                </div>
              ),
          )}
        </div>
      )}
    </div>
  );
}
