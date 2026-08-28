import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../AuthContext.jsx';

export default function Workspaces() {
  const { token, user } = useAuth();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState([]);

  const [workspaceName, setWorkspaceName] =
    useState('');

  const [visitType, setVisitType] =
    useState('Patient Visit');

  const [frequency, setFrequency] =
    useState('One Time');

  const [creating, setCreating] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState(null);

  const [createdWorkspace, setCreatedWorkspace] =
    useState(null);

  const [error, setError] =
    useState('');

  // =====================================================
  // LOAD WORKSPACES
  // =====================================================

  async function loadWorkspaces() {
    try {
      setError('');

      const data = await api('/rooms/mine', {
        token,
      });

      setRooms(data.rooms || []);

    } catch (err) {
      console.error(
        'Failed to load workspaces:',
        err
      );

      setError(
        err.message ||
        'Failed to load workspaces.'
      );
    }
  }

  useEffect(() => {
    if (token) {
      loadWorkspaces();
    }
  }, [token]);

  // =====================================================
  // CREATE WORKSPACE
  // =====================================================

  async function handleCreateWorkspace(e) {
    e.preventDefault();

    setError('');
    setCreatedWorkspace(null);

    if (!workspaceName.trim()) {
      setError(
        'Please enter a workspace name.'
      );
      return;
    }

    setCreating(true);

    try {
      const data = await api('/rooms', {
        method: 'POST',
        token,

        body: {
          title: workspaceName.trim(),
          visit_type: visitType,
          frequency: frequency,
        },
      });

      setCreatedWorkspace(data.room);

      setWorkspaceName('');
      setVisitType('Patient Visit');
      setFrequency('One Time');

      await loadWorkspaces();

    } catch (err) {
      console.error(
        'Workspace creation failed:',
        err
      );

      setError(
        err.message ||
        'Unable to create workspace.'
      );

    } finally {
      setCreating(false);
    }
  }

  // =====================================================
  // DELETE WORKSPACE
  // =====================================================

  async function handleDeleteWorkspace(room) {

    const confirmed = window.confirm(
      `Are you sure you want to delete "${room.title || 'Trial Visit'}"?\n\nThis will also delete all vitals recorded in this workspace.`
    );

    if (!confirmed) {
      return;
    }

    setError('');
    setDeletingId(room.id);

    try {

      console.log(
        'Deleting workspace:',
        room.id
      );

      const data = await api(
        `/rooms/id/${room.id}`,
        {
          method: 'DELETE',
          token,
        }
      );

      console.log(
        'Delete response:',
        data
      );

      // Immediately remove from UI
      setRooms((previousRooms) =>
        previousRooms.filter(
          (item) =>
            item.id !== room.id
        )
      );

      // If deleted workspace was the
      // recently created one
      if (
        createdWorkspace &&
        createdWorkspace.id === room.id
      ) {
        setCreatedWorkspace(null);
      }

    } catch (err) {

      console.error(
        'Delete workspace failed:',
        err
      );

      setError(
        err.message ||
        'Unable to delete workspace.'
      );

    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#F8FAFD',
      }}
    >

      {/* =================================================
          TOP BAR
      ================================================= */}

      <header
        style={{
          height: 62,
          background: '#FFFFFF',
          borderBottom:
            '1px solid rgba(30,50,90,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}
      >

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >

          <button
            onClick={() =>
              navigate('/doctor')
            }
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#0758D8',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            ← Dashboard
          </button>

          <span
            style={{
              color: '#C1C7D0',
            }}
          >
            /
          </span>

          <span
            style={{
              color: '#687386',
              fontSize: 13,
            }}
          >
            My Workspaces
          </span>

        </div>

        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background:
              'linear-gradient(135deg,#D8E5F5,#A9BED9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#40516A',
            fontWeight: 700,
            fontSize: 13,
          }}
        >
          {user?.name
            ? user.name
                .charAt(0)
                .toUpperCase()
            : 'D'}
        </div>

      </header>


      {/* =================================================
          PAGE
      ================================================= */}

      <main
        style={{
          maxWidth: 1100,
          margin: '0 auto',
          padding: '35px 30px 70px',
        }}
      >

        {/* HEADER */}

        <div
          style={{
            marginBottom: 28,
          }}
        >

          <div
            style={{
              color: '#7A8392',
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            Doctor Portal
            {' › '}
            My Workspaces
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: 30,
              color: '#1E293B',
            }}
          >
            My Workspaces
          </h1>

          <p
            style={{
              margin: '8px 0 0',
              color: '#7A8392',
              fontSize: 14,
            }}
          >
            Create and manage your patient
            visit workspaces.
          </p>

        </div>


        {/* =================================================
            ERROR
        ================================================= */}

        {error && (
          <div
            style={{
              background:
                'rgba(200,86,47,0.08)',
              border:
                '1px solid rgba(200,86,47,0.18)',
              color: '#A33D1C',
              borderRadius: 9,
              padding: '12px 14px',
              fontSize: 13,
              marginBottom: 20,
            }}
          >
            {error}
          </div>
        )}


        {/* =================================================
            CREATE WORKSPACE
        ================================================= */}

        <section
          style={{
            background: '#FFFFFF',
            border:
              '1px solid rgba(30,50,90,0.07)',
            borderRadius: 14,
            padding: 30,
            boxShadow:
              '0 8px 30px rgba(50,80,130,0.06)',
            marginBottom: 28,
          }}
        >

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 13,
              marginBottom: 27,
            }}
          >

            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 10,
                background: '#EAF2FF',
                color: '#0758D8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
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
                  color: '#1E293B',
                }}
              >
                Create New Workspace
              </h2>

              <p
                style={{
                  margin: '5px 0 0',
                  color: '#7A8392',
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

            {/* NAME */}

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
                display: 'grid',
                gridTemplateColumns:
                  '1fr 1fr',
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


            <button
              type="submit"
              disabled={creating}
              className="btn btn-primary"
              style={{
                width: '100%',
                height: 45,
                fontSize: 13,
              }}
            >
              {creating
                ? 'Creating Workspace...'
                : '+ Create Workspace'}
            </button>

          </form>


          {/* =================================================
              CREATED
          ================================================= */}

          {createdWorkspace && (
            <div
              style={{
                marginTop: 22,
                padding: 22,
                borderRadius: 11,
                background:
                  'rgba(15,110,86,0.07)',
                border:
                  '1px solid rgba(15,110,86,0.14)',
                textAlign: 'center',
              }}
            >

              <div
                style={{
                  color: '#0F6E56',
                  fontWeight: 700,
                  fontSize: 15,
                }}
              >
                Workspace created successfully!
              </div>

              <div
                style={{
                  color: '#7A8392',
                  fontSize: 12,
                  marginTop: 6,
                }}
              >
                Share this code with your patient
              </div>

              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: 32,
                  fontWeight: 800,
                  letterSpacing: 5,
                  color: '#0F6E56',
                  marginTop: 8,
                }}
              >
                {createdWorkspace.code}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 10,
                  marginTop: 15,
                }}
              >

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    navigate(
                      `/room/${createdWorkspace.code}`
                    )
                  }
                >
                  Enter Workspace
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    setCreatedWorkspace(null)
                  }
                >
                  Create Another
                </button>

              </div>

            </div>
          )}

        </section>


        {/* =================================================
            EXISTING WORKSPACES
        ================================================= */}

        <section
          style={{
            background: '#FFFFFF',
            border:
              '1px solid rgba(30,50,90,0.07)',
            borderRadius: 14,
            padding: 25,
            boxShadow:
              '0 8px 30px rgba(50,80,130,0.05)',
          }}
        >

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 20,
            }}
          >

            <div>

              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  color: '#1E293B',
                }}
              >
                Existing Workspaces
              </h2>

              <p
                style={{
                  margin: '4px 0 0',
                  color: '#7A8392',
                  fontSize: 12,
                }}
              >
                Your created patient workspaces.
              </p>

            </div>

            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 9,
                background: '#EAF2FF',
                color: '#0758D8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
              }}
            >
              {rooms.length}
            </div>

          </div>


          {rooms.length === 0 ? (

            <div
              style={{
                padding: '45px 20px',
                textAlign: 'center',
                color: '#7A8392',
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
                  color: '#4B5565',
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
                Create your first workspace above.
              </div>

            </div>

          ) : (

            <div>

              {rooms.map((room) => (

                <div
                  key={room.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 20,
                    padding: 15,
                    border:
                      '1px solid #EDF0F4',
                    borderRadius: 10,
                    marginBottom: 10,
                  }}
                >

                  {/* LEFT */}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >

                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 9,
                        background: '#F0F5FF',
                        color: '#0758D8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 17,
                      }}
                    >
                      ▣
                    </div>

                    <div>

                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: '#2F3949',
                        }}
                      >
                        {room.title ||
                          'Trial Visit'}
                      </div>

                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          color: '#858D9A',
                        }}
                      >
                        Code:{' '}

                        <span
                          style={{
                            fontFamily:
                              'monospace',
                            fontWeight: 700,
                          }}
                        >
                          {room.code}
                        </span>

                        {room.patient_name &&
                          ` · ${room.patient_name}`}
                      </div>

                    </div>

                  </div>


                  {/* RIGHT */}

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >

                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color:
                          room.status ===
                          'active'
                            ? '#0F6E56'
                            : room.status ===
                              'completed'
                              ? '#777'
                              : '#A5680F',
                        textTransform:
                          'capitalize',
                      }}
                    >
                      ● {room.status}
                    </span>


                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() =>
                        navigate(
                          `/room/${room.code}`
                        )
                      }
                    >
                      Enter
                    </button>


                    {/* DELETE */}

                    <button
                      type="button"
                      disabled={
                        deletingId === room.id
                      }
                      onClick={() =>
                        handleDeleteWorkspace(
                          room
                        )
                      }
                      style={{
                        height: 34,
                        padding:
                          '0 13px',
                        border:
                          '1px solid rgba(190,55,55,0.25)',
                        borderRadius: 7,
                        background:
                          deletingId === room.id
                            ? '#F5F5F5'
                            : '#FFF5F5',
                        color:
                          deletingId === room.id
                            ? '#999'
                            : '#C0392B',
                        cursor:
                          deletingId === room.id
                            ? 'not-allowed'
                            : 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      {deletingId === room.id
                        ? 'Deleting...'
                        : 'Delete'}
                    </button>

                  </div>

                </div>

              ))}

            </div>

          )}

        </section>

      </main>

    </div>
  );
}


// =========================================================
// STYLES
// =========================================================

const labelStyle = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: '#5F6979',
  marginBottom: 7,
};

const inputStyle = {
  width: '100%',
  height: 44,
  padding: '0 13px',
  border:
    '1px solid #DFE4EC',
  borderRadius: 8,
  background: '#FFFFFF',
  outline: 'none',
  fontSize: 13,
  color: '#354052',
  boxSizing: 'border-box',
};