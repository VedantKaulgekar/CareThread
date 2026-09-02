import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, useAuth } from "../AuthContext.jsx";
import DashboardNav from "../components/DashboardNav.jsx";

export default function DoctorWorkspaces() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    drug_name: "",
    title: "",
    description: "",
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [justCreated, setJustCreated] = useState(null);

  async function refresh() {
    const data = await api("/workspaces/mine", { token });
    setWorkspaces(data.workspaces);
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setCreating(true);
    try {
      const data = await api("/workspaces", {
        method: "POST",
        token,
        body: form,
      });
      setJustCreated(data.workspace);
      setForm({ drug_name: "", title: "", description: "" });
      setShowCreate(false);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  if (!workspaces) {
    return (
      <div>
        <DashboardNav title="Your Workspaces" />
        <div
          className="container text-muted"
          style={{ padding: 60, textAlign: "center" }}
        >
          Loading…
        </div>
      </div>
    );
  }

  return (
    <div>
      <DashboardNav title="Your Workspaces" />
      <div className="container" style={{ padding: "32px 32px 64px" }}>
        <div
          className="flex justify-between items-center"
          style={{ marginBottom: 24 }}
        >
          <div>
            <h1 style={{ fontSize: 28 }}>Your workspaces</h1>
            <p className="text-muted mt-8">
              One workspace per drug — patients enroll with a join code, then
              attend scheduled visits inside it.
            </p>
          </div>
          <div className="flex gap-8">
            <Link to="/doctor/analytics" className="btn btn-secondary">
              View analytics
            </Link>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreate((s) => !s)}
            >
              {showCreate ? "Cancel" : "+ New workspace"}
            </button>
          </div>
        </div>

        {justCreated && !showCreate && (
          <div
            className="card"
            style={{
              padding: 20,
              marginBottom: 24,
              background: "var(--teal-light)",
              border: "none",
            }}
          >
            <div className="flex justify-between items-center">
              <div>
                <div style={{ fontWeight: 700 }}>
                  {justCreated.title} created
                </div>
                <div className="text-sm text-muted mt-8">
                  Share this join code with enrolled patients:{" "}
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 700,
                      fontSize: 15,
                      color: "var(--teal)",
                    }}
                  >
                    {justCreated.code}
                  </span>
                </div>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => navigate(`/doctor/workspaces/${justCreated.id}`)}
              >
                Open workspace
              </button>
            </div>
          </div>
        )}

        {showCreate && (
          <div className="card" style={{ padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontSize: 17, marginBottom: 16 }}>
              Create a new workspace
            </h3>
            {error && <div className="error-box">{error}</div>}
            <form onSubmit={handleCreate}>
              <div className="field-row">
                <div className="field">
                  <label>Drug name</label>
                  <input
                    required
                    value={form.drug_name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, drug_name: e.target.value }))
                    }
                    placeholder="e.g. Drug X"
                  />
                </div>
                <div className="field">
                  <label>Workspace title</label>
                  <input
                    required
                    value={form.title}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, title: e.target.value }))
                    }
                    placeholder="e.g. Drug X — Phase 2"
                  />
                </div>
              </div>
              <div className="field">
                <label>Description (optional)</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Brief notes about this trial"
                />
              </div>
              <button className="btn btn-primary" disabled={creating}>
                {creating ? "Creating…" : "Create workspace"}
              </button>
            </form>
          </div>
        )}

        {workspaces.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🧪</div>
            <h3 style={{ marginBottom: 8 }}>No workspaces yet</h3>
            <p className="text-muted">
              Create your first workspace to start enrolling patients.
            </p>
          </div>
        ) : (
          <div style={wsGrid}>
            {workspaces.map((w) => (
              <div
                key={w.id}
                className="card"
                style={wsCard}
                onClick={() => navigate(`/doctor/workspaces/${w.id}`)}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div
                      className="text-sm text-muted"
                      style={{ fontWeight: 600 }}
                    >
                      {w.drug_name}
                    </div>
                    <h3 style={{ fontSize: 18, marginTop: 2 }}>{w.title}</h3>
                  </div>
                  <span
                    className={`badge ${w.status === "active" ? "badge-active" : "badge-completed"}`}
                  >
                    <span className="badge-dot" />
                    {w.status}
                  </span>
                </div>
                {w.description && (
                  <p
                    className="text-muted text-sm mt-8"
                    style={{ lineHeight: 1.5 }}
                  >
                    {w.description}
                  </p>
                )}
                <div className="flex gap-16 mt-16" style={{ fontSize: 13 }}>
                  <span>
                    <strong>{w.patient_count}</strong>{" "}
                    <span className="text-muted">patients</span>
                  </span>
                  <span>
                    <strong>{w.visit_count}</strong>{" "}
                    <span className="text-muted">visits</span>
                  </span>
                  <span>
                    <strong>{w.upcoming_visit_count}</strong>{" "}
                    <span className="text-muted">upcoming</span>
                  </span>
                </div>
                <div style={codeRow}>
                  Join code{" "}
                  <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                    {w.code}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const wsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
  gap: 20,
};
const wsCard = {
  padding: 22,
  cursor: "pointer",
  transition: "box-shadow 0.15s",
};
const codeRow = {
  marginTop: 16,
  paddingTop: 14,
  borderTop: "1px solid var(--line-soft)",
  fontSize: 12.5,
  color: "var(--ink-soft)",
};
