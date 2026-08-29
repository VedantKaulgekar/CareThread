import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, useAuth } from "../AuthContext.jsx";

export default function Workspaces() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);
  const [workspaceName, setWorkspaceName] = useState("");
  const [visitType, setVisitType] = useState("Patient Visit");
  const [frequency, setFrequency] = useState("One Time");

  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const [createdWorkspace, setCreatedWorkspace] = useState(null);
  const [error, setError] = useState("");

  // ============================================================
  // LOAD WORKSPACES
  // ============================================================

  async function loadWorkspaces() {
    try {
      setError("");

      const data = await api("/rooms/mine", {
        method: "GET",
        token,
      });

      setRooms(data.rooms || []);
    } catch (err) {
      console.error("Failed to load workspaces:", err);

      setError(
        err?.message ||
          "Unable to load workspaces."
      );
    }
  }

  // ============================================================
  // INITIAL LOAD
  // ============================================================

  useEffect(() => {
    if (token) {
      loadWorkspaces();
    }
  }, [token]);

  // ============================================================
  // CREATE WORKSPACE
  // ============================================================

  async function handleCreateWorkspace(e) {
    e.preventDefault();

    setError("");
    setCreatedWorkspace(null);

    if (!workspaceName.trim()) {
      setError(
        "Please enter a workspace name."
      );
      return;
    }

    setCreating(true);

    try {
      const data = await api("/rooms", {
        method: "POST",
        token,
        body: {
          title: workspaceName.trim(),
          visit_type: visitType,
          frequency: frequency,
        },
      });

      setCreatedWorkspace(data.room);

      setWorkspaceName("");
      setVisitType("Patient Visit");
      setFrequency("One Time");

      await loadWorkspaces();
    } catch (err) {
      console.error(
        "Workspace creation failed:",
        err
      );

      setError(
        err?.message ||
          "Unable to create workspace."
      );
    } finally {
      setCreating(false);
    }
  }

  // ============================================================
  // DELETE WORKSPACE
  // IMPORTANT:
  // CORRECT URL = /api/rooms/:id
  // NOT /api/rooms/id/:id
  // ============================================================

  async function handleDeleteWorkspace(roomId) {
    if (!roomId) {
      setError(
        "Workspace ID is missing."
      );
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this workspace?\n\nThis action cannot be undone."
    );

    if (!confirmed) {
      return;
    }

    setDeletingId(roomId);
    setError("");

    try {
      console.log(
        "Deleting workspace:",
        roomId
      );

      const data = await api(
        `/rooms/${roomId}`,
        {
          method: "DELETE",
          token,
        }
      );

      console.log(
        "Workspace deleted successfully:",
        data
      );

      // Remove immediately from UI
      setRooms((currentRooms) =>
        currentRooms.filter(
          (room) =>
            room.id !== roomId
        )
      );

      // Clear success workspace if it was deleted
      if (
        createdWorkspace &&
        createdWorkspace.id === roomId
      ) {
        setCreatedWorkspace(null);
      }

    } catch (err) {
      console.error(
        "Delete workspace failed:",
        err
      );

      setError(
        err?.message ||
          "Unable to delete workspace."
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ============================================================
  // ENTER WORKSPACE
  // ============================================================

  function handleEnterWorkspace(code) {
    if (!code) {
      setError(
        "Workspace code is missing."
      );
      return;
    }

    navigate(`/room/${code}`);
  }

  // ============================================================
  // FORMAT DATE
  // ============================================================

  function formatDate(date) {
    if (!date) return "—";

    try {
      return new Date(date).toLocaleString();
    } catch {
      return date;
    }
  }

  // ============================================================
  // STATUS STYLE
  // ============================================================

  function getStatusStyle(status) {
    if (status === "active") {
      return {
        background: "#E7F7F1",
        color: "#0F6E56",
      };
    }

    if (status === "completed") {
      return {
        background: "#F0EEF5",
        color: "#716D82",
      };
    }

    return {
      background: "#FFF4DF",
      color: "#A5680F",
    };
  }

  // ============================================================
  // UI
  // ============================================================

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8FAFD",
      }}
    >
      {/* ======================================================
          TOP BAR
      ====================================================== */}

      <header
        style={{
          height: 62,
          background: "#FFFFFF",
          borderBottom:
            "1px solid rgba(30,50,90,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 28px",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={() =>
              navigate("/doctor")
            }
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "#0758D8",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ← Dashboard
          </button>

          <span
            style={{
              color: "#C1C7D0",
            }}
          >
            /
          </span>

          <span
            style={{
              color: "#687386",
              fontSize: 13,
            }}
          >
            My Workspaces
          </span>
        </div>

        <button
          type="button"
          onClick={() =>
            navigate("/profile")
          }
          style={{
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "none",
            background:
              "linear-gradient(135deg,#D8E5F5,#A9BED9)",
            color: "#40516A",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {user?.name
            ?.charAt(0)
            ?.toUpperCase() || "D"}
        </button>
      </header>

      {/* ======================================================
          MAIN
      ====================================================== */}

      <main
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "35px 30px 70px",
        }}
      >
        {/* ====================================================
            PAGE HEADER
        ==================================================== */}

        <div
          style={{
            marginBottom: 28,
          }}
        >
          <div
            style={{
              color: "#7A8392",
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            Doctor Portal
            {"  ›  "}
            My Workspaces
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 30,
              color: "#1E293B",
            }}
          >
            My Workspaces
          </h1>

          <p
            style={{
              margin: "8px 0 0",
              color: "#7A8392",
              fontSize: 14,
            }}
          >
            Create and manage your patient
            visit workspaces.
          </p>
        </div>

        {/* ====================================================
            ERROR
        ==================================================== */}

        {error && (
          <div
            style={{
              background:
                "rgba(200,86,47,0.08)",
              border:
                "1px solid rgba(200,86,47,0.18)",
              color: "#A33D1C",
              borderRadius: 8,
              padding: "11px 13px",
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}

        {/* ====================================================
            CREATE WORKSPACE
        ==================================================== */}

        <section
          style={{
            background: "#FFFFFF",
            border:
              "1px solid rgba(30,50,90,0.07)",
            borderRadius: 14,
            padding: 30,
            boxShadow:
              "0 8px 30px rgba(50,80,130,0.06)",
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 13,
              marginBottom: 27,
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: "#EAF2FF",
                color: "#0758D8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 700,
              }}
            >
              +
            </div>

            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 19,
                  color: "#1E293B",
                }}
              >
                Create New Workspace
              </h2>

              <p
                style={{
                  margin: "5px 0 0",
                  color: "#7A8392",
                  fontSize: 13,
                }}
              >
                Set up a workspace for
                your patient visit.
              </p>
            </div>
          </div>

          <form
            onSubmit={
              handleCreateWorkspace
            }
          >
            {/* WORKSPACE NAME */}

            <div
              style={{
                marginBottom: 20,
              }}
            >
              <label style={labelStyle}>
                Workspace Name
              </label>

              <input
                type="text"
                value={workspaceName}
                onChange={(e) =>
                  setWorkspaceName(
                    e.target.value
                  )
                }
                placeholder="e.g. Phase II — Amoxicillin Efficacy"
                style={inputStyle}
              />
            </div>

            {/* VISIT TYPE + FREQUENCY */}

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "1fr 1fr",
                gap: 20,
                marginBottom: 20,
              }}
            >
              <div>
                <label style={labelStyle}>
                  Visit Type
                </label>

                <select
                  value={visitType}
                  onChange={(e) =>
                    setVisitType(
                      e.target.value
                    )
                  }
                  style={inputStyle}
                >
                  <option>
                    Patient Visit
                  </option>

                  <option>
                    Initial Consultation
                  </option>

                  <option>
                    Follow-up Visit
                  </option>

                  <option>
                    Clinical Trial
                  </option>

                  <option>
                    Medication Review
                  </option>

                  <option>
                    Research Study
                  </option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>
                  Frequency
                </label>

                <select
                  value={frequency}
                  onChange={(e) =>
                    setFrequency(
                      e.target.value
                    )
                  }
                  style={inputStyle}
                >
                  <option>
                    One Time
                  </option>

                  <option>
                    Daily
                  </option>

                  <option>
                    Weekly
                  </option>

                  <option>
                    Biweekly
                  </option>

                  <option>
                    Monthly
                  </option>
                </select>
              </div>
            </div>

            {/* CREATE */}

            <button
              type="submit"
              disabled={creating}
              className="btn btn-primary"
              style={{
                width: "100%",
                height: 45,
                fontSize: 13,
              }}
            >
              {creating
                ? "Creating Workspace..."
                : "+ Create Workspace"}
            </button>
          </form>

          {/* ==================================================
              SUCCESS
          ================================================== */}

          {createdWorkspace && (
            <div
              style={{
                marginTop: 22,
                padding: 22,
                borderRadius: 11,
                background:
                  "rgba(15,110,86,0.07)",
                border:
                  "1px solid rgba(15,110,86,0.14)",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  color: "#0F6E56",
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                Workspace created
                successfully!
              </div>

              <div
                style={{
                  color: "#7A8392",
                  fontSize: 12,
                  marginTop: 6,
                }}
              >
                Share this code with
                your patient
              </div>

              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 32,
                  fontWeight: 800,
                  letterSpacing: 5,
                  color: "#0F6E56",
                  marginTop: 8,
                }}
              >
                {createdWorkspace.code}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  gap: 10,
                  marginTop: 15,
                  flexWrap: "wrap",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    handleEnterWorkspace(
                      createdWorkspace.code
                    )
                  }
                >
                  Enter Workspace
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setCreatedWorkspace(
                      null
                    )
                  }
                >
                  Create Another
                </button>
              </div>
            </div>
          )}
        </section>

        {/* ====================================================
            EXISTING WORKSPACES
        ==================================================== */}

        <section
          style={{
            background: "#FFFFFF",
            border:
              "1px solid rgba(30,50,90,0.07)",
            borderRadius: 14,
            padding: 25,
            boxShadow:
              "0 8px 30px rgba(50,80,130,0.05)",
          }}
        >
          {/* HEADER */}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
            }}
          >
            <div>
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  color: "#1E293B",
                }}
              >
                Existing Workspaces
              </h2>

              <p
                style={{
                  margin: "4px 0 0",
                  color: "#7A8392",
                  fontSize: 12,
                }}
              >
                Your created patient
                workspaces.
              </p>
            </div>

            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: "#EAF2FF",
                color: "#0758D8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
              }}
            >
              {rooms.length}
            </div>
          </div>

          {/* EMPTY */}

          {rooms.length === 0 ? (
            <div
              style={{
                padding: "45px 20px",
                textAlign: "center",
                color: "#7A8392",
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  marginBottom: 10,
                }}
              >
                ▣
              </div>

              <div
                style={{
                  fontWeight: 600,
                  color: "#4B5565",
                  fontSize: 14,
                }}
              >
                No workspaces yet
              </div>

              <div
                style={{
                  fontSize: 12,
                  marginTop: 5,
                }}
              >
                Create your first
                workspace above.
              </div>
            </div>
          ) : (
            <div>
              {rooms.map((room) => {
                const statusStyle =
                  getStatusStyle(
                    room.status
                  );

                return (
                  <div
                    key={room.id}
                    style={{
                      border:
                        "1px solid #EDF0F4",
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 10,
                      background:
                        "#FFFFFF",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "space-between",
                        gap: 15,
                        flexWrap:
                          "wrap",
                      }}
                    >
                      {/* LEFT */}

                      <div
                        style={{
                          display: "flex",
                          alignItems:
                            "center",
                          gap: 12,
                        }}
                      >
                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius: 10,
                            background:
                              "#F0F5FF",
                            color:
                              "#0758D8",
                            display:
                              "flex",
                            alignItems:
                              "center",
                            justifyContent:
                              "center",
                            fontSize: 18,
                          }}
                        >
                          ▣
                        </div>

                        <div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color:
                                "#2F3949",
                            }}
                          >
                            {room.title ||
                              "Trial Visit"}
                          </div>

                          <div
                            style={{
                              marginTop: 5,
                              fontSize: 11,
                              color:
                                "#858D9A",
                            }}
                          >
                            Code:{" "}
                            <span
                              style={{
                                fontFamily:
                                  "monospace",
                                fontWeight: 700,
                                color:
                                  "#4B5565",
                              }}
                            >
                              {room.code}
                            </span>

                            {room.patient_name &&
                              ` · ${room.patient_name}`}
                          </div>

                          <div
                            style={{
                              marginTop: 4,
                              fontSize: 10,
                              color:
                                "#9AA1AD",
                            }}
                          >
                            Created:{" "}
                            {formatDate(
                              room.created_at
                            )}
                          </div>
                        </div>
                      </div>

                      {/* RIGHT */}

                      <div
                        style={{
                          display: "flex",
                          alignItems:
                            "center",
                          gap: 9,
                          flexWrap:
                            "wrap",
                        }}
                      >
                        <span
                          style={{
                            ...statusStyle,
                            borderRadius: 20,
                            padding:
                              "5px 9px",
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform:
                              "capitalize",
                          }}
                        >
                          ● {room.status}
                        </span>

                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() =>
                            handleEnterWorkspace(
                              room.code
                            )
                          }
                        >
                          Enter
                        </button>

                        {/* DELETE */}

                        <button
                          type="button"
                          disabled={
                            deletingId ===
                            room.id
                          }
                          onClick={() =>
                            handleDeleteWorkspace(
                              room.id
                            )
                          }
                          style={{
                            height: 32,
                            padding:
                              "0 11px",
                            border:
                              "1px solid #F0C7C0",
                            background:
                              deletingId ===
                              room.id
                                ? "#F8F8F8"
                                : "#FFF7F5",
                            color:
                              deletingId ===
                              room.id
                                ? "#999999"
                                : "#C8562F",
                            borderRadius: 7,
                            cursor:
                              deletingId ===
                              room.id
                                ? "not-allowed"
                                : "pointer",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {deletingId ===
                          room.id
                            ? "Deleting..."
                            : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

/* ============================================================
   STYLES
============================================================ */

const labelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#5F6979",
  marginBottom: 7,
};

const inputStyle = {
  width: "100%",
  height: 44,
  padding: "0 13px",
  border: "1px solid #DFE4EC",
  borderRadius: 8,
  background: "#FFFFFF",
  outline: "none",
  fontSize: 13,
  color: "#354052",
  boxSizing: "border-box",
};