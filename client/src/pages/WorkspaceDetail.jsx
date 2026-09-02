import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { api, useAuth } from "../AuthContext.jsx";
import DashboardNav from "../components/DashboardNav.jsx";
import WorkspaceDashboardTab from "../components/WorkspaceDashboardTab.jsx";
import WorkspacePatientsTab from "../components/WorkspacePatientsTab.jsx";
import WorkspaceScheduleTab from "../components/WorkspaceScheduleTab.jsx";
import ProtocolCard from "../components/ProtocolCard.jsx";

const TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "patients", label: "Patients" },
  { key: "schedule", label: "Schedule" },
];

export default function WorkspaceDetail() {
  const { workspaceId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("dashboard");
  const [workspace, setWorkspace] = useState(null);
  const [dash, setDash] = useState(null);
  const [patients, setPatients] = useState(null);
  const [visits, setVisits] = useState(null);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function loadWorkspace() {
    try {
      const data = await api(`/workspaces/${workspaceId}`, { token });
      setWorkspace(data.workspace);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadDashboard() {
    const data = await api(`/workspaces/${workspaceId}/dashboard`, { token });
    setDash(data);
  }

  async function loadPatients() {
    const data = await api(`/workspaces/${workspaceId}/patients`, { token });
    setPatients(data.patients);
  }

  async function loadVisits() {
    const data = await api(`/workspaces/${workspaceId}/visits`, { token });
    setVisits(data.visits);
  }

  function startEdit() {
    setEditForm({
      title: workspace.title,
      drug_name: workspace.drug_name,
      description: workspace.description || "",
      status: workspace.status,
    });
    setEditError("");
    setEditing(true);
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setSavingEdit(true);
    setEditError("");
    try {
      const data = await api(`/workspaces/${workspaceId}`, {
        method: "PUT",
        token,
        body: editForm,
      });
      setWorkspace(data.workspace);
      setEditing(false);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteWorkspace() {
    const confirmed = window.confirm(
      `Permanently delete "${workspace.title}"? This removes every patient enrollment, visit, vitals record, and AI summary in this workspace. This cannot be undone.`,
    );
    if (!confirmed) return;
    // Require typing the title, so a doctor can't nuke a workspace with
    // one accidental click on an already-open confirm dialog.
    const typed = window.prompt(
      `Type the workspace title ("${workspace.title}") to confirm deletion:`,
    );
    if (typed !== workspace.title) {
      if (typed !== null) alert("That didn't match — nothing was deleted.");
      return;
    }
    setDeleting(true);
    try {
      await api(`/workspaces/${workspaceId}`, { method: "DELETE", token });
      navigate("/doctor");
    } catch (err) {
      alert(err.message);
      setDeleting(false);
    }
  }

  useEffect(() => {
    loadWorkspace();
  }, [workspaceId]);

  useEffect(() => {
    if (!workspace) return;
    if (tab === "dashboard") loadDashboard();
    if (tab === "patients") loadPatients();
    if (tab === "schedule") {
      loadPatients();
      loadVisits();
    }
  }, [tab, workspace]);

  if (error) {
    return (
      <div>
        <DashboardNav />
        <div className="container" style={{ padding: 60, textAlign: "center" }}>
          <p className="error-box" style={{ display: "inline-block" }}>
            {error}
          </p>
          <div>
            <Link to="/doctor" className="btn btn-secondary mt-16">
              Back to workspaces
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div>
        <DashboardNav />
        <div className="container text-muted" style={{ padding: 60 }}>
          Loading workspace…
        </div>
      </div>
    );
  }

  return (
    <div>
      <DashboardNav title={workspace.title} />
      <div className="container" style={{ padding: "28px 32px 64px" }}>
        <Link
          to="/doctor"
          className="text-muted text-sm"
          style={{ marginBottom: 12, display: "inline-block" }}
        >
          ← All workspaces
        </Link>

        <div
          className="flex justify-between items-start"
          style={{ marginBottom: 24 }}
        >
          {!editing ? (
            <div>
              <div className="text-sm text-muted" style={{ fontWeight: 600 }}>
                {workspace.drug_name}
              </div>
              <h1 style={{ fontSize: 26, marginTop: 2 }}>{workspace.title}</h1>
              {workspace.description && (
                <p className="text-muted mt-8" style={{ maxWidth: 520 }}>
                  {workspace.description}
                </p>
              )}
              <div className="flex gap-8" style={{ marginTop: 12 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={startEdit}
                >
                  Edit workspace
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ color: "#dc2626" }}
                  onClick={handleDeleteWorkspace}
                  disabled={deleting}
                >
                  {deleting ? "Deleting…" : "Delete workspace"}
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSaveEdit}
              className="card"
              style={{ padding: 18, width: 460 }}
            >
              {editError && <div className="error-box">{editError}</div>}
              <div className="field">
                <label>Title</label>
                <input
                  required
                  value={editForm.title}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, title: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label>Drug name</label>
                <input
                  required
                  value={editForm.drug_name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, drug_name: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea
                  rows={3}
                  value={editForm.description}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, description: e.target.value }))
                  }
                />
              </div>
              <div className="field">
                <label>Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, status: e.target.value }))
                  }
                >
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
              <div className="flex gap-8">
                <button
                  className="btn btn-primary btn-sm"
                  disabled={savingEdit}
                >
                  {savingEdit ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setEditing(false)}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          <div style={codeBox}>
            <div className="text-sm text-muted">Join code</div>
            <div
              style={{
                fontFamily: "monospace",
                fontWeight: 800,
                fontSize: 20,
                color: "var(--purple)",
              }}
            >
              {workspace.code}
            </div>
          </div>
        </div>

        <ProtocolCard workspace={workspace} onUpdated={setWorkspace} />

        <div style={tabBar}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{ ...tabBtn, ...(tab === t.key ? tabBtnActive : {}) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          {tab === "dashboard" && <WorkspaceDashboardTab dash={dash} />}
          {tab === "patients" && (
            <WorkspacePatientsTab
              patients={patients}
              workspaceId={workspaceId}
              token={token}
              onChanged={loadPatients}
            />
          )}
          {tab === "schedule" && (
            <WorkspaceScheduleTab
              workspaceId={workspaceId}
              patients={patients}
              visits={visits}
              onChanged={() => {
                loadVisits();
                loadPatients();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const codeBox = {
  textAlign: "right",
  background: "var(--purple-light)",
  padding: "10px 18px",
  borderRadius: 12,
};
const tabBar = {
  display: "flex",
  gap: 4,
  borderBottom: "1.5px solid var(--line-soft)",
};
const tabBtn = {
  padding: "10px 18px",
  border: "none",
  background: "none",
  cursor: "pointer",
  fontSize: 14.5,
  fontWeight: 600,
  color: "var(--ink-soft)",
  borderBottom: "2px solid transparent",
  marginBottom: -1.5,
};
const tabBtnActive = {
  color: "var(--purple)",
  borderBottom: "2px solid var(--purple)",
};
