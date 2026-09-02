import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("ct_token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("ct_user");
    return raw ? JSON.parse(raw) : null;
  });
  // Until this resolves, we don't yet know if a cached session is still
  // valid — routes should treat this like "logged out" rather than
  // flashing the dashboard and then bouncing the user back out.
  const [checkingSession, setCheckingSession] = useState(
    () => !!localStorage.getItem("ct_token"),
  );

  const login = useCallback((token, user) => {
    localStorage.setItem("ct_token", token);
    localStorage.setItem("ct_user", JSON.stringify(user));
    setToken(token);
    setUser(user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("ct_token");
    localStorage.removeItem("ct_user");
    setToken(null);
    setUser(null);
  }, []);

  // A token restored from localStorage is just a cached claim — it was
  // never actually re-checked against the server, so restarting the
  // server (which now rotates JWT_SECRET) left the UI looking "still
  // logged in" until some unrelated request happened to 401. Validate
  // once on load instead, so a dead session gets kicked back to login
  // immediately rather than silently.
  useEffect(() => {
    let cancelled = false;
    async function validate() {
      if (!token) {
        setCheckingSession(false);
        return;
      }
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        if (!res.ok) {
          logout();
        } else {
          const data = await res.json();
          if (data.user) {
            localStorage.setItem("ct_user", JSON.stringify(data.user));
            setUser(data.user);
          }
        }
      } catch {
        // Network hiccup — don't nuke the session over a transient
        // failure; leave the cached user in place.
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }
    validate();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{ token, user, login, logout, checkingSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

// Every response that comes back 401 means the token is dead (expired,
// or invalidated by a server restart) — force a logout immediately
// instead of letting the page sit in a half-authenticated state.
function forceLogoutOn401() {
  localStorage.removeItem("ct_token");
  localStorage.removeItem("ct_user");
  // Full reload rather than a router redirect: simplest way to guarantee
  // every component (including ones outside AuthContext's re-render
  // cycle) picks up the logged-out state consistently.
  if (!window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
}

export async function api(path, { method = "GET", body, token } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) forceLogoutOn401();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// For file downloads that need the Authorization header (a plain <a href>
// can't attach one) — fetches as a blob and triggers a normal browser
// download via a throwaway link.
export async function downloadFile(path, { token, filename } = {}) {
  const res = await fetch(`/api${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) forceLogoutOn401();
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Download failed");
  }
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "download";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}
