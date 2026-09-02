import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../AuthContext.jsx";

// Session-only conversation — deliberately not persisted anywhere.
// Refreshing the page starts a clean chat, by design.
export default function ChatAgent() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [toasts, setToasts] = useState([]);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, open]);

  function pushToast(text) {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    const nextMessages = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply || "(no reply)" },
      ]);
      (data.actions || []).forEach(pushToast);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `⚠ ${err.message}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <>
      {/* Toasts */}
      <div style={toastStack}>
        {toasts.map((t) => (
          <div key={t.id} style={toastStyle}>
            <span style={{ marginRight: 8 }}>✅</span>
            {t.text}
          </div>
        ))}
      </div>

      {/* Floating launcher */}
      {!open && (
        <button
          style={launcherStyle}
          onClick={() => setOpen(true)}
          aria-label="Open CareThread Assistant"
        >
          💬
        </button>
      )}

      {/* Panel */}
      {open && (
        <div style={panelStyle}>
          <div style={panelHeader}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>
                CareThread Assistant
              </div>
              <div style={{ fontSize: 11.5, opacity: 0.8 }}>
                Ask it to schedule visits, check requests, and more
              </div>
            </div>
            <button
              style={closeBtn}
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div ref={listRef} style={panelBody}>
            {messages.length === 0 && (
              <div style={emptyState}>
                Try: "What visits do I have coming up?" or "Schedule a visit for
                Jordan next Tuesday at 2pm."
              </div>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                style={m.role === "user" ? bubbleUser : bubbleAssistant}
              >
                {m.content}
              </div>
            ))}
            {sending && (
              <div style={bubbleAssistant}>
                <span style={typingDots}>●●●</span>
              </div>
            )}
          </div>

          <div style={inputRow}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message the assistant…"
              rows={1}
              style={textareaStyle}
              disabled={sending}
            />
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSend}
              disabled={sending || !input.trim()}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const launcherStyle = {
  position: "fixed",
  bottom: 24,
  right: 24,
  width: 56,
  height: 56,
  borderRadius: "50%",
  background: "linear-gradient(135deg, var(--purple), var(--purple-dark))",
  color: "white",
  border: "none",
  fontSize: 22,
  cursor: "pointer",
  boxShadow: "0 8px 24px rgba(91,79,191,0.35)",
  zIndex: 1000,
};

const panelStyle = {
  position: "fixed",
  bottom: 24,
  right: 24,
  width: 360,
  maxWidth: "calc(100vw - 32px)",
  height: 500,
  maxHeight: "calc(100vh - 48px)",
  background: "#ffffff",
  borderRadius: 16,
  boxShadow: "0 16px 48px rgba(0,0,0,0.22)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  zIndex: 1000,
  border: "1px solid var(--line-soft)",
};

const panelHeader = {
  background: "linear-gradient(135deg, var(--purple), var(--purple-dark))",
  color: "white",
  padding: "14px 16px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const closeBtn = {
  background: "transparent",
  border: "none",
  color: "white",
  fontSize: 16,
  cursor: "pointer",
  opacity: 0.85,
};

const panelBody = {
  flex: 1,
  overflowY: "auto",
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  background: "#faf9fd",
};

const emptyState = {
  color: "var(--ink-soft, #6b6f8a)",
  fontSize: 12.5,
  padding: "20px 8px",
  textAlign: "center",
  lineHeight: 1.6,
};

const bubbleBase = {
  maxWidth: "85%",
  padding: "9px 12px",
  borderRadius: 12,
  fontSize: 13.5,
  lineHeight: 1.45,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const bubbleUser = {
  ...bubbleBase,
  alignSelf: "flex-end",
  background: "var(--purple)",
  color: "white",
  borderBottomRightRadius: 3,
};

const bubbleAssistant = {
  ...bubbleBase,
  alignSelf: "flex-start",
  background: "#ffffff",
  color: "var(--ink, #1a1a2e)",
  border: "1px solid var(--line-soft)",
  borderBottomLeftRadius: 3,
};

const typingDots = { letterSpacing: 2, opacity: 0.5 };

const inputRow = {
  display: "flex",
  gap: 8,
  padding: 12,
  borderTop: "1px solid var(--line-soft)",
  background: "#ffffff",
};

const textareaStyle = {
  flex: 1,
  resize: "none",
  border: "1px solid var(--line-soft)",
  borderRadius: 10,
  padding: "8px 10px",
  fontSize: 13.5,
  fontFamily: "inherit",
  maxHeight: 80,
};

const toastStack = {
  position: "fixed",
  top: 16,
  right: 16,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  zIndex: 1100,
};

const toastStyle = {
  background: "#1a1a2e",
  color: "white",
  padding: "10px 14px",
  borderRadius: 10,
  fontSize: 13,
  boxShadow: "0 8px 20px rgba(0,0,0,0.25)",
  maxWidth: 320,
};
