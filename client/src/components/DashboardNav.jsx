import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import ChatAgent from "./ChatAgent.jsx";

export default function DashboardNav({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <nav className="nav">
        <div className="nav-inner">
          <Link to="/" className="brand">
            <span className="brand-mark">C</span>CareThread
          </Link>
          <div className="flex items-center gap-16">
            {title && <span className="text-muted text-sm">{title}</span>}
            <div style={{ position: "relative" }} ref={menuRef}>
              <div
                className="flex items-center gap-8"
                style={{ cursor: "pointer" }}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <div style={avatarStyle(user)}>
                  {user?.name?.[0]?.toUpperCase() || "?"}
                </div>
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {user?.name}
                </span>
              </div>

              {menuOpen && (
                <div style={dropdownStyle}>
                  <Link
                    to="/settings"
                    className="dropdown-item"
                    style={dropdownItemStyle}
                    onClick={() => setMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <button
                    className="dropdown-item"
                    style={{ ...dropdownItemStyle, ...dropdownButtonStyle }}
                    onClick={() => {
                      logout();
                      navigate("/");
                    }}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>
      <ChatAgent />
    </>
  );
}

function avatarStyle(user) {
  return {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background: user?.role === "doctor" ? "var(--purple)" : "var(--teal)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
  };
}

const dropdownStyle = {
  position: "absolute",
  top: "110%",
  right: 0,
  background: "var(--paper, #fff)",
  border: "1px solid var(--line-soft, #e5e7eb)",
  borderRadius: 10,
  boxShadow: "var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.12))",
  minWidth: 160,
  padding: 6,
  zIndex: 50,
};

const dropdownItemStyle = {
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "8px 12px",
  borderRadius: 6,
  fontSize: 14,
  color: "inherit",
  textDecoration: "none",
  background: "none",
  border: "none",
  cursor: "pointer",
};

const dropdownButtonStyle = {
  color: "#dc2626",
};
