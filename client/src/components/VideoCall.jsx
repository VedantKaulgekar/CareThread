import React, { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const ICE_SERVERS = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

export default function VideoCall({
  roomCode,
  userId,
  userName,
  role,
  onLeave,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteSocketIdRef = useRef(null);
  const containerRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [peerJoined, setPeerJoined] = useState(false);
  const [peerLeftNotice, setPeerLeftNotice] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [status, setStatus] = useState("Connecting…");

  useEffect(() => {
    let mounted = true;

    async function setup() {
      const socket = io("/", { path: "/socket.io" });
      socketRef.current = socket;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (!mounted) return;
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (e) {
        setStatus("Camera/mic permission denied");
      }

      socket.emit("room:join", { roomCode, userId, userName, role });
      setStatus("Waiting for the other participant…");

      socket.on("peer:joined", async ({ socketId }) => {
        remoteSocketIdRef.current = socketId;
        setPeerJoined(true);
        setPeerLeftNotice(false);
        setStatus("Connecting video…");
        await createPeerConnection(socket, socketId, true);
      });

      socket.on("webrtc:offer", async ({ offer, from }) => {
        remoteSocketIdRef.current = from;
        setPeerJoined(true);
        setPeerLeftNotice(false);
        const pc = await createPeerConnection(socket, from, false);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc:answer", { answer, to: from });
      });

      socket.on("webrtc:answer", async ({ answer }) => {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(
            new RTCSessionDescription(answer),
          );
          setConnected(true);
          setStatus("Connected");
        }
      });

      socket.on("webrtc:ice-candidate", async ({ candidate }) => {
        if (pcRef.current && candidate) {
          try {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (e) {}
        }
      });

      // Doctor marked the visit complete — everyone in the room should exit.
      socket.on("room:completed", () => {
        cleanupAndLeave();
      });

      socket.on("peer:left", () => {
        setPeerJoined(false);
        setConnected(false);
        setPeerLeftNotice(true);
        setStatus(`${role === "doctor" ? "Patient" : "Doctor"} left the call`);
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        if (pcRef.current) {
          pcRef.current.close();
          pcRef.current = null;
        }
      });
    }

    async function createPeerConnection(socket, remoteSocketId, isInitiator) {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) => pc.addTrack(track, localStreamRef.current));
      }

      pc.ontrack = (event) => {
        if (remoteVideoRef.current)
          remoteVideoRef.current.srcObject = event.streams[0];
        setConnected(true);
        setStatus("Connected");
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("webrtc:ice-candidate", {
            candidate: event.candidate,
            to: remoteSocketId,
          });
        }
      };

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit("webrtc:offer", { roomCode, offer, to: remoteSocketId });
      }

      return pc;
    }

    setup();

    return () => {
      mounted = false;
      teardownMedia();
    };
  }, [roomCode]);

  function teardownMedia() {
    if (localStreamRef.current)
      localStreamRef.current.getTracks().forEach((t) => t.stop());
    if (pcRef.current) pcRef.current.close();
    if (socketRef.current) {
      socketRef.current.emit("room:leave", { roomCode });
      socketRef.current.disconnect();
    }
  }

  // Explicit, always-available exit path — this is what was missing before.
  // Works whether or not a peer is connected, and regardless of role.
  function cleanupAndLeave() {
    teardownMedia();
    if (onLeave) onLeave();
  }

  function toggleMic() {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMicOn(track.enabled);
    }
  }

  function toggleCam() {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOn(track.enabled);
    }
  }

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }

  useEffect(() => {
    function onFsChange() {
      setIsFullscreen(!!document.fullscreenElement);
    }
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  return (
    <div
      ref={containerRef}
      className="card"
      style={{ padding: 16, background: isFullscreen ? "#0d0c1a" : undefined }}
    >
      <div
        className="flex justify-between items-center"
        style={{ marginBottom: 12 }}
      >
        <div className="flex items-center gap-8">
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: connected ? "var(--teal)" : "var(--amber)",
            }}
          />
          <span className="text-sm" style={{ fontWeight: 600 }}>
            {status}
          </span>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={toggleFullscreen}>
          {isFullscreen ? "⤡ Exit fullscreen" : "⤢ Fullscreen"}
        </button>
      </div>

      {/* Main stage: remote participant large, local self-view as a floating PIP thumbnail —
          this reads as a real call instead of two equal tiny boxes. */}
      <div
        style={{ ...stage, height: isFullscreen ? "calc(100vh - 160px)" : 460 }}
      >
        {peerJoined ? (
          <video ref={remoteVideoRef} autoPlay playsInline style={stageVideo} />
        ) : (
          <div style={waitingBox}>
            {peerLeftNotice
              ? `${role === "doctor" ? "Patient" : "Doctor"} left the call.`
              : `Waiting for ${role === "doctor" ? "patient" : "doctor"} to join…`}
          </div>
        )}
        <div style={stageLabel}>{role === "doctor" ? "Patient" : "Doctor"}</div>

        <div style={pipTile}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={pipVideo}
          />
          <div style={pipLabel}>{userName} (You)</div>
        </div>
      </div>

      <div className="flex gap-8 justify-center" style={{ marginTop: 14 }}>
        <button className="btn btn-secondary btn-sm" onClick={toggleMic}>
          {micOn ? "🎙️ Mute" : "🔇 Unmute"}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={toggleCam}>
          {camOn ? "📹 Stop video" : "📷 Start video"}
        </button>
        <button
          className="btn btn-sm"
          style={leaveBtn}
          onClick={cleanupAndLeave}
        >
          🚪 Leave visit
        </button>
      </div>
    </div>
  );
}

const stage = {
  position: "relative",
  width: "100%",
  background: "#1b1930",
  borderRadius: 12,
  overflow: "hidden",
};
const stageVideo = { width: "100%", height: "100%", objectFit: "cover" };
const stageLabel = {
  position: "absolute",
  bottom: 12,
  left: 12,
  background: "rgba(0,0,0,0.55)",
  color: "white",
  fontSize: 13,
  padding: "4px 10px",
  borderRadius: 6,
};
const waitingBox = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#9490b8",
  fontSize: 14,
  textAlign: "center",
  padding: 20,
};
const pipTile = {
  position: "absolute",
  top: 14,
  right: 14,
  width: 160,
  aspectRatio: "4 / 3",
  borderRadius: 10,
  overflow: "hidden",
  background: "#100f1e",
  boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
  border: "1px solid rgba(255,255,255,0.15)",
};
const pipVideo = { width: "100%", height: "100%", objectFit: "cover" };
const pipLabel = {
  position: "absolute",
  bottom: 4,
  left: 6,
  background: "rgba(0,0,0,0.55)",
  color: "white",
  fontSize: 10.5,
  padding: "2px 6px",
  borderRadius: 5,
};
const leaveBtn = { background: "#e5484d", color: "white", border: "none" };
