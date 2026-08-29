import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

import { api, useAuth } from "../AuthContext.jsx";
import DashboardNav from "../components/DashboardNav.jsx";


/* =========================================================
   CONSTANTS
========================================================= */

const STATUS_COLORS = {
  Open: "#A5680F",
  Active: "#0F6E56",
  Completed: "#8B899B",
};


/* =========================================================
   DOCTOR DASHBOARD
========================================================= */

export default function DoctorDashboard() {

  const { token, user, logout } = useAuth();

  const navigate = useNavigate();

  const location = useLocation();


  /* =======================================================
     STATE
  ======================================================= */

  const [dash, setDash] = useState(null);

  const [sidebarExpanded, setSidebarExpanded] =
    useState(false);

  const [joinPatientId, setJoinPatientId] =
    useState("all");

  const [loadingError, setLoadingError] =
    useState("");


  /* =======================================================
     LOAD DASHBOARD
  ======================================================= */

  async function refresh() {

    if (!token) {
      return;
    }

    try {

      setLoadingError("");

      const data = await api(
        "/dashboard/doctor",
        {
          token,
        }
      );

      setDash(data);

    } catch (error) {

      console.error(
        "Dashboard refresh failed:",
        error
      );

      setLoadingError(
        error?.message ||
        "Unable to load dashboard."
      );

    }
  }


  /* =======================================================
     INITIAL LOAD
  ======================================================= */

  useEffect(() => {

    refresh();

  }, [token]);


  /* =======================================================
     LOGOUT
  ======================================================= */

  function handleLogout() {

    if (logout) {

      logout();

    } else {

      localStorage.removeItem("ct_token");
      localStorage.removeItem("ct_user");

    }

    navigate("/");

  }


  /* =======================================================
     PATIENT IDS
  ======================================================= */

  const patientIds = dash
    ? [
        ...new Set(
          (dash.rooms || [])
            .filter(
              (room) => room.patient_id
            )
            .map(
              (room) => room.patient_id
            )
        ),
      ]
    : [];


  /* =======================================================
     TREND DATA
  ======================================================= */

  const trendData = dash
    ? (dash.trend || [])
        .filter(
          (item) =>
            joinPatientId === "all" ||
            item.patient_id === joinPatientId
        )
        .map(
          (item, index) => ({
            ...item,
            idx: index + 1,
            label: `Visit ${index + 1}`,
          })
        )
    : [];


  /* =======================================================
     MAIN LAYOUT
  ======================================================= */

  return (

    <div
      style={{
        minHeight: "100vh",
        background: "#F8FAFD",
      }}
    >

      {/* ===================================================
          EXISTING DASHBOARD NAVBAR

          IMPORTANT:
          Do NOT recreate the navbar here.

          DashboardNav.jsx remains responsible for:
          - CareThread
          - Doctor name
          - Profile avatar
          - Logout
      =================================================== */}

      <DashboardNav
        title="Doctor Dashboard"
      />


      {/* ===================================================
          SIDEBAR

          Sidebar is BELOW navbar.

          It does NOT contain:
          - CareThread
          - Doctor profile
          - Avatar
          - Meetings
      =================================================== */}

      <DoctorSidebar

        expanded={
          sidebarExpanded
        }

        setExpanded={
          setSidebarExpanded
        }

        navigate={
          navigate
        }

        location={
          location
        }

        handleLogout={
          handleLogout
        }

      />


      {/* ===================================================
          MAIN CONTENT
      =================================================== */}

      <div
        style={{
          marginLeft:
            sidebarExpanded
              ? 225
              : 76,

          minHeight:
            "calc(100vh - 62px)",

          transition:
            "margin-left 0.28s cubic-bezier(0.4, 0, 0.2, 1)",

          boxSizing:
            "border-box",
        }}
      >


        {/* =================================================
            LOADING / ERROR
        ================================================= */}

        {!dash ? (

          <div
            style={{
              padding:
                "70px 40px",

              textAlign:
                "center",

              color:
                "#7A8392",

              fontSize:
                14,
            }}
          >

            {loadingError ? (

              <div>

                <div
                  style={{
                    color:
                      "#C8562F",

                    marginBottom:
                      14,
                  }}
                >
                  {loadingError}
                </div>


                <button
                  className="btn btn-primary"
                  onClick={refresh}
                >
                  Try Again
                </button>

              </div>

            ) : (

              "Loading dashboard…"

            )}

          </div>

        ) : (

          <main
            style={{
              padding:
                "32px 32px 64px",

              boxSizing:
                "border-box",
            }}
          >


            {/* ===========================================
                PAGE HEADER
            =========================================== */}

            <div
              style={{
                marginBottom:
                  28,
              }}
            >

              <div
                style={{
                  fontSize:
                    12,

                  color:
                    "#7A8392",

                  marginBottom:
                    8,
                }}
              >

                CareThread
                {"  ›  "}
                Doctor Dashboard

              </div>


              <h1
                style={{
                  margin:
                    0,

                  fontSize:
                    29,

                  fontWeight:
                    700,

                  color:
                    "#1E293B",
                }}
              >

                Good Morning
                {user?.name
                  ? `, ${user.name}`
                  : ", Doctor"}.

              </h1>


              <p
                style={{
                  margin:
                    "7px 0 0",

                  color:
                    "#7A8392",

                  fontSize:
                    14,
                }}
              >

                Here is the latest overview
                of your patients and visits.

              </p>

            </div>


            {/* ===========================================
                STATISTICS
            =========================================== */}

            <div
              style={
                statsGrid
              }
            >

              <StatCard
                label="Total Patients"
                value={
                  dash.totalPatients ??
                  0
                }
                color="purple"
                icon="♟"
                trend="Patients"
              />


              <StatCard
                label="Total Visits"
                value={
                  dash.totalVisits ??
                  0
                }
                color="teal"
                icon="▣"
                trend="Visits"
              />


              <StatCard
                label="Active Visits"
                value={
                  dash.activeVisits ??
                  0
                }
                color="amber"
                icon="●"
                trend="Active"
              />


              <StatCard
                label="Completed Visits"
                value={
                  dash.completedVisits ??
                  0
                }
                color="coral"
                icon="✓"
                trend="Completed"
              />

            </div>


            {/* ===========================================
                ANALYTICS GRID
            =========================================== */}

            <div
              style={
                analyticsGrid
              }
            >


              {/* =========================================
                  VITALS TREND
              ========================================= */}

              <div
                className="card"
                style={{
                  padding:
                    24,
                }}
              >

                <div
                  style={{
                    display:
                      "flex",

                    justifyContent:
                      "space-between",

                    alignItems:
                      "center",

                    marginBottom:
                      18,

                    gap:
                      15,
                  }}
                >

                  <div>

                    <h3
                      style={{
                        margin:
                          0,

                        fontSize:
                          17,

                        color:
                          "#273244",
                      }}
                    >
                      Vitals Trend
                    </h3>


                    <p
                      style={{
                        margin:
                          "4px 0 0",

                        fontSize:
                          12,

                        color:
                          "#7A8392",
                      }}
                    >
                      Patient vitals across visits
                    </p>

                  </div>


                  <select

                    value={
                      joinPatientId
                    }

                    onChange={
                      (event) =>
                        setJoinPatientId(
                          event.target.value
                        )
                    }

                    style={{
                      padding:
                        "7px 10px",

                      borderRadius:
                        8,

                      border:
                        "1px solid #DDE2EA",

                      background:
                        "#FFFFFF",

                      fontSize:
                        12,

                      color:
                        "#4B5565",

                      outline:
                        "none",

                      maxWidth:
                        180,
                    }}
                  >

                    <option value="all">
                      All Patients
                    </option>


                    {patientIds.map(
                      (patientId) => {

                        const room =
                          (
                            dash.rooms ||
                            []
                          ).find(
                            (item) =>
                              item.patient_id ===
                              patientId
                          );


                        return (

                          <option
                            key={
                              patientId
                            }
                            value={
                              patientId
                            }
                          >

                            {
                              room?.patient_name ||
                              patientId.slice(
                                0,
                                8
                              )
                            }

                          </option>

                        );

                      }
                    )}

                  </select>

                </div>


                {trendData.length ===
                0 ? (

                  <EmptyChart
                    text={
                      "No vitals recorded yet. Data will appear here after your first visit."
                    }
                  />

                ) : (

                  <ResponsiveContainer
                    width="100%"
                    height={280}
                  >

                    <LineChart
                      data={
                        trendData
                      }
                    >

                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#EFEDE4"
                      />


                      <XAxis
                        dataKey="label"
                        tick={{
                          fontSize:
                            11,
                        }}
                      />


                      <YAxis
                        tick={{
                          fontSize:
                            11,
                        }}
                      />


                      <Tooltip />


                      <Legend
                        wrapperStyle={{
                          fontSize:
                            12,
                        }}
                      />


                      <Line
                        type="monotone"
                        dataKey="systolic"
                        stroke="#5B4FBF"
                        strokeWidth={2}
                        dot={{
                          r: 3,
                        }}
                        name="BP Systolic"
                      />


                      <Line
                        type="monotone"
                        dataKey="diastolic"
                        stroke="#0F6E56"
                        strokeWidth={2}
                        dot={{
                          r: 3,
                        }}
                        name="BP Diastolic"
                      />


                      <Line
                        type="monotone"
                        dataKey="heart_rate"
                        stroke="#C8562F"
                        strokeWidth={2}
                        dot={{
                          r: 3,
                        }}
                        name="Heart Rate"
                      />

                    </LineChart>

                  </ResponsiveContainer>

                )}

              </div>


              {/* =========================================
                  VISIT STATUS
              ========================================= */}

              <div
                className="card"
                style={{
                  padding:
                    24,
                }}
              >

                <h3
                  style={{
                    margin:
                      0,

                    fontSize:
                      17,

                    color:
                      "#273244",
                  }}
                >
                  Visit Status
                </h3>


                <p
                  style={{
                    margin:
                      "4px 0 0",

                    fontSize:
                      12,

                    color:
                      "#7A8392",
                  }}
                >
                  Current status of your visits
                </p>


                {(
                  dash.statusBreakdown ||
                  []
                ).length === 0 ? (

                  <EmptyChart
                    text={
                      "No visit status data available."
                    }
                  />

                ) : (

                  <ResponsiveContainer
                    width="100%"
                    height={280}
                  >

                    <PieChart>

                      <Pie

                        data={
                          dash.statusBreakdown
                        }

                        dataKey="value"

                        nameKey="name"

                        innerRadius={55}

                        outerRadius={90}

                        paddingAngle={4}

                      >

                        {(
                          dash.statusBreakdown ||
                          []
                        ).map(
                          (
                            entry,
                            index
                          ) => (

                            <Cell

                              key={
                                index
                              }

                              fill={
                                STATUS_COLORS[
                                  entry.name
                                ] ||
                                "#8B899B"
                              }

                            />

                          )
                        )}

                      </Pie>


                      <Tooltip />


                      <Legend
                        wrapperStyle={{
                          fontSize:
                            12,
                        }}
                      />

                    </PieChart>

                  </ResponsiveContainer>

                )}

              </div>

            </div>


            {/* ===========================================
                VITAL AVERAGES
            =========================================== */}

            <div
              className="card"
              style={{
                padding:
                  24,

                marginTop:
                  24,
              }}
            >

              <div
                style={{
                  marginBottom:
                    18,
                }}
              >

                <h3
                  style={{
                    margin:
                      0,

                    fontSize:
                      17,

                    color:
                      "#273244",
                  }}
                >
                  Patient Vital Averages
                </h3>


                <p
                  style={{
                    margin:
                      "4px 0 0",

                    fontSize:
                      12,

                    color:
                      "#7A8392",
                  }}
                >
                  Average values across all
                  recorded visits.
                </p>

              </div>


              <div
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "repeat(3, minmax(0, 1fr))",

                  gap:
                    16,
                }}
              >

                <AverageCard
                  label="Temperature"
                  value={
                    dash.summary
                      ?.avgTemperature
                  }
                  unit="°F"
                />


                <AverageCard
                  label="Systolic BP"
                  value={
                    dash.summary
                      ?.avgSystolic
                  }
                  unit="mmHg"
                />


                <AverageCard
                  label="Diastolic BP"
                  value={
                    dash.summary
                      ?.avgDiastolic
                  }
                  unit="mmHg"
                />


                <AverageCard
                  label="Blood Sugar"
                  value={
                    dash.summary
                      ?.avgSugar
                  }
                  unit="mg/dL"
                />


                <AverageCard
                  label="SpO₂"
                  value={
                    dash.summary
                      ?.avgSpo2
                  }
                  unit="%"
                />


                <AverageCard
                  label="Heart Rate"
                  value={
                    dash.summary
                      ?.avgHeartRate
                  }
                  unit="bpm"
                />

              </div>

            </div>


            {/* ===========================================
                QUICK ACTIONS
            =========================================== */}

            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(3, minmax(0, 1fr))",

                gap:
                  16,

                marginTop:
                  24,
              }}
            >

              <QuickAction
                icon="▣"
                title="My Workspaces"
                description={
                  "Create and manage patient workspaces."
                }
                onClick={() =>
                  navigate(
                    "/workspaces"
                  )
                }
              />


              <QuickAction
                icon="♙"
                title="Patients"
                description={
                  "View your patients and their details."
                }
                onClick={() =>
                  navigate(
                    "/patients"
                  )
                }
              />


              <QuickAction
                icon="⌁"
                title="Analytics"
                description={
                  "Review patient and visit analytics."
                }
                onClick={() =>
                  navigate(
                    "/analytics"
                  )
                }
              />

            </div>

          </main>

        )}

      </div>

    </div>

  );
}


/* =========================================================
   SIDEBAR
========================================================= */

function DoctorSidebar({
  expanded,
  setExpanded,
  navigate,
  location,
  handleLogout,
}) {

  const currentPath =
    location?.pathname ||
    window.location.pathname;


  /* =======================================================
     SIDEBAR ITEMS
     
     Meetings intentionally removed.
  ======================================================= */

  const menuItems = [

    {
      label:
        "Dashboard",

      icon:
        "▦",

      path:
        "/doctor",
    },


    {
      label:
        "My Workspaces",

      icon:
        "▣",

      path:
        "/workspaces",
    },


    {
      label:
        "Patients",

      icon:
        "♙",

      path:
        "/patients",
    },


    {
      label:
        "Analytics",

      icon:
        "⌁",

      path:
        "/analytics",
    },


    {
      label:
        "Profile",

      icon:
        "◉",

      path:
        "/profile",
    },

  ];


  function isActive(path) {

    if (
      path ===
      "/doctor"
    ) {

      return (
        currentPath ===
        "/doctor"
      );

    }


    return currentPath.startsWith(
      path
    );

  }


  return (

    <aside

      onMouseEnter={() =>
        setExpanded(true)
      }

      onMouseLeave={() =>
        setExpanded(false)
      }

      style={{

        position:
          "fixed",

        top:
          62,

        left:
          0,

        bottom:
          0,

        width:
          expanded
            ? 225
            : 76,

        background:
          "#FFFFFF",

        borderRight:
          "1px solid rgba(30,50,90,0.08)",

        zIndex:
          90,

        overflow:
          "hidden",

        transition:
          "width 0.28s cubic-bezier(0.4, 0, 0.2, 1)",

        boxShadow:
          expanded
            ? "8px 0 30px rgba(30,50,90,0.08)"
            : "none",

        display:
          "flex",

        flexDirection:
          "column",

      }}
    >


      {/* =================================================
          NAVIGATION
      ================================================= */}

      <nav
        style={{
          padding:
            "24px 10px",

          flex:
            1,

          overflowY:
            "auto",
        }}
      >

        {menuItems.map(
          (item) => {

            const active =
              isActive(
                item.path
              );


            return (

              <button

                key={
                  item.label
                }

                type="button"

                onClick={() =>
                  navigate(
                    item.path
                  )
                }

                title={
                  !expanded
                    ? item.label
                    : ""
                }

                style={{

                  width:
                    "100%",

                  height:
                    46,

                  border:
                    "none",

                  background:
                    active
                      ? "#EAF2FF"
                      : "transparent",

                  color:
                    active
                      ? "#0758D8"
                      : "#626C7D",

                  borderRadius:
                    8,

                  display:
                    "flex",

                  alignItems:
                    "center",

                  gap:
                    11,

                  padding:
                    "0 12px",

                  marginBottom:
                    6,

                  cursor:
                    "pointer",

                  boxShadow:
                    active
                      ? "inset -3px 0 0 #0758D8"
                      : "none",

                  transition:
                    "all 0.2s ease",

                  whiteSpace:
                    "nowrap",

                  textAlign:
                    "left",

                }}

                onMouseEnter={(e) => {

                  if (!active) {

                    e.currentTarget.style.background =
                      "#F6F8FC";

                  }

                }}

                onMouseLeave={(e) => {

                  if (!active) {

                    e.currentTarget.style.background =
                      "transparent";

                  }

                }}

              >

                {/* ICON */}

                <span
                  style={{
                    width:
                      28,

                    minWidth:
                      28,

                    height:
                      28,

                    display:
                      "flex",

                    alignItems:
                      "center",

                    justifyContent:
                      "center",

                    fontSize:
                      18,

                    color:
                      active
                        ? "#0758D8"
                        : "#737B8C",

                    transition:
                      "transform 0.2s ease",
                  }}
                >
                  {item.icon}
                </span>


                {/* LABEL */}

                <span
                  style={{
                    opacity:
                      expanded
                        ? 1
                        : 0,

                    transform:
                      expanded
                        ? "translateX(0)"
                        : "translateX(-8px)",

                    transition:
                      "opacity 0.18s ease, transform 0.22s ease",

                    fontSize:
                      13.5,

                    fontWeight:
                      active
                        ? 600
                        : 500,
                  }}
                >
                  {item.label}
                </span>

              </button>

            );

          }
        )}

      </nav>


      {/* =================================================
          LOGOUT
      ================================================= */}

      <div
        style={{
          padding:
            "12px 10px 18px",

          borderTop:
            "1px solid rgba(30,50,90,0.07)",
        }}
      >

        <button

          type="button"

          onClick={
            handleLogout
          }

          title={
            !expanded
              ? "Logout"
              : ""
          }

          style={{

            width:
              "100%",

            height:
              44,

            border:
              "none",

            background:
              "transparent",

            borderRadius:
              8,

            display:
              "flex",

            alignItems:
              "center",

            gap:
              11,

            padding:
              "0 12px",

            cursor:
              "pointer",

            color:
              "#697386",

            whiteSpace:
              "nowrap",

            transition:
              "background 0.2s ease",

            textAlign:
              "left",
          }}

          onMouseEnter={(e) => {

            e.currentTarget.style.background =
              "#F6F8FC";

          }}

          onMouseLeave={(e) => {

            e.currentTarget.style.background =
              "transparent";

          }}

        >

          <span
            style={{
              width:
                28,

              minWidth:
                28,

              textAlign:
                "center",

              fontSize:
                18,
            }}
          >
            ↪
          </span>


          <span
            style={{
              opacity:
                expanded
                  ? 1
                  : 0,

              transform:
                expanded
                  ? "translateX(0)"
                  : "translateX(-8px)",

              transition:
                "opacity 0.18s ease, transform 0.22s ease",

              fontSize:
                13.5,
            }}
          >
            Logout
          </span>

        </button>

      </div>

    </aside>

  );
}


/* =========================================================
   STAT CARD
========================================================= */

function StatCard({
  label,
  value,
  color,
  icon,
  trend,
}) {

  const colorMap = {

    purple:
      "var(--purple)",

    teal:
      "var(--teal)",

    amber:
      "var(--amber)",

    coral:
      "var(--coral)",

  };


  return (

    <div
      className="card"
      style={{
        padding:
          "18px 20px",

        minHeight:
          138,

        boxSizing:
          "border-box",
      }}
    >

      <div
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "center",
        }}
      >

        <div
          style={{
            width:
              32,

            height:
              32,

            borderRadius:
              8,

            background:
              "rgba(70,110,220,0.08)",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            color:
              colorMap[color],

            fontSize:
              17,
          }}
        >
          {icon}
        </div>


        <span
          style={{
            background:
              "rgba(15,110,86,0.08)",

            color:
              "#0F6E56",

            borderRadius:
              20,

            padding:
              "4px 8px",

            fontSize:
              9,

            fontWeight:
              600,
          }}
        >
          {trend}
        </span>

      </div>


      <div
        style={{
          marginTop:
            22,

          fontSize:
            13,

          color:
            "#7A8392",

          fontWeight:
            600,
        }}
      >
        {label}
      </div>


      <div
        style={{
          fontSize:
            30,

          fontWeight:
            700,

          color:
            colorMap[color],

          marginTop:
            2,
        }}
      >
        {value}
      </div>

    </div>

  );
}


/* =========================================================
   AVERAGE CARD
========================================================= */

function AverageCard({
  label,
  value,
  unit,
}) {

  return (

    <div
      style={{
        padding:
          "15px 16px",

        border:
          "1px solid #EDF0F4",

        borderRadius:
          10,

        background:
          "#FAFBFD",
      }}
    >

      <div
        style={{
          fontSize:
            12,

          color:
            "#7A8392",

          marginBottom:
            7,
        }}
      >
        {label}
      </div>


      <div
        style={{
          fontSize:
            19,

          fontWeight:
            700,

          color:
            "#344054",
        }}
      >

        {value !== null &&
        value !== undefined

          ? `${value} ${unit}`

          : "—"}

      </div>

    </div>

  );
}


/* =========================================================
   QUICK ACTION
========================================================= */

function QuickAction({
  icon,
  title,
  description,
  onClick,
}) {

  return (

    <button

      type="button"

      onClick={
        onClick
      }

      style={{

        border:
          "1px solid #E5EAF1",

        background:
          "#FFFFFF",

        borderRadius:
          12,

        padding:
          18,

        textAlign:
          "left",

        cursor:
          "pointer",

        display:
          "flex",

        alignItems:
          "center",

        gap:
          14,

        transition:
          "all 0.2s ease",

        boxShadow:
          "0 4px 16px rgba(30,50,90,0.03)",

      }}

      onMouseEnter={(e) => {

        e.currentTarget.style.transform =
          "translateY(-2px)";

        e.currentTarget.style.boxShadow =
          "0 8px 22px rgba(30,50,90,0.08)";

      }}

      onMouseLeave={(e) => {

        e.currentTarget.style.transform =
          "translateY(0)";

        e.currentTarget.style.boxShadow =
          "0 4px 16px rgba(30,50,90,0.03)";

      }}

    >

      <div
        style={{
          width:
            42,

          height:
            42,

          minWidth:
            42,

          borderRadius:
            10,

          background:
            "#EAF2FF",

          color:
            "#0758D8",

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "center",

          fontSize:
            19,
        }}
      >
        {icon}
      </div>


      <div>

        <div
          style={{
            fontSize:
              14,

            fontWeight:
              700,

            color:
              "#273244",
          }}
        >
          {title}
        </div>


        <div
          style={{
            fontSize:
              11,

            color:
              "#7A8392",

            marginTop:
              4,
          }}
        >
          {description}
        </div>

      </div>

    </button>

  );
}


/* =========================================================
   EMPTY CHART
========================================================= */

function EmptyChart({
  text,
}) {

  return (

    <div
      style={{
        height:
          220,

        display:
          "flex",

        alignItems:
          "center",

        justifyContent:
          "center",

        color:
          "#7A8392",

        fontSize:
          13.5,

        textAlign:
          "center",

        padding:
          "0 30px",

        boxSizing:
          "border-box",
      }}
    >
      {text}
    </div>

  );
}


/* =========================================================
   GRID STYLES
========================================================= */

const statsGrid = {

  display:
    "grid",

  gridTemplateColumns:
    "repeat(4, minmax(0, 1fr))",

  gap:
    16,

  marginBottom:
    28,

};


const analyticsGrid = {

  display:
    "grid",

  gridTemplateColumns:
    "minmax(0, 1.5fr) minmax(300px, 1fr)",

  gap:
    24,

  alignItems:
    "start",

};