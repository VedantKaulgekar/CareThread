import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

export default function DashboardNav({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isLoginPage = location.pathname === "/login";
  const isSignupPage = location.pathname === "/signup";

  function handleLogout() {
    logout();
    navigate("/");
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        {/* Logo */}
        <Link to="/" className="brand">
          <span className="brand-mark">C</span>
          CareThread
        </Link>

        <div className="flex items-center gap-16">
          {/* ================= LOGGED IN ================= */}
          {user ? (
            <>
              {title && (
                <span className="text-muted text-sm">
                  {title}
                </span>
              )}

              <div className="flex items-center gap-8">
                <div style={avatarStyle(user)}>
                  {user.name?.[0]?.toUpperCase() || "?"}
                </div>

                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {user.name}
                </span>
              </div>

              <button
                className="btn btn-ghost btn-sm"
                onClick={handleLogout}
              >
                Log out
              </button>
            </>
          ) : (
            <>
              {/* ================= LOGIN PAGE ================= */}
              {isLoginPage && (
                <Link
                  to="/signup?role=patient"
                  className="btn btn-primary btn-sm"
                >
                  Sign up
                </Link>
              )}

              {/* ================= SIGNUP PAGE ================= */}
              {isSignupPage && (
                <Link
                  to="/login"
                  className="btn btn-ghost btn-sm"
                >
                  Sign in
                </Link>
              )}

              {/* ================= OTHER LOGGED-OUT PAGES ================= */}
              {!isLoginPage && !isSignupPage && (
                <>
                  <Link
                    to="/login"
                    className="btn btn-ghost btn-sm"
                  >
                    Sign in
                  </Link>

                  <Link
                    to="/signup?role=patient"
                    className="btn btn-primary btn-sm"
                  >
                    Get started
                  </Link>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function avatarStyle(user) {
  return {
    width: 30,
    height: 30,
    borderRadius: "50%",
    background:
      user?.role === "doctor"
        ? "var(--purple)"
        : "var(--teal)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 700,
  };
}