import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const ICE_SERVERS = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

export default function VideoCall({ roomCode, userId, userName, role }) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteSocketIdRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [peerJoined, setPeerJoined] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [status, setStatus] = useState('Connecting…');

  useEffect(() => {
    let mounted = true;

    async function setup() {
      const socket = io('/', { path: '/socket.io' });
      socketRef.current = socket;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) return;
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      } catch (e) {
        setStatus('Camera/mic permission denied');
      }

      socket.emit('room:join', { roomCode, userId, userName, role });
      setStatus('Waiting for the other participant…');

      socket.on('peer:joined', async ({ socketId }) => {
        remoteSocketIdRef.current = socketId;
        setPeerJoined(true);
        setStatus('Connecting video…');
        await createPeerConnection(socket, socketId, true);
      });

      socket.on('webrtc:offer', async ({ offer, from }) => {
        remoteSocketIdRef.current = from;
        setPeerJoined(true);
        const pc = await createPeerConnection(socket, from, false);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc:answer', { answer, to: from });
      });

      socket.on('webrtc:answer', async ({ answer }) => {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          setConnected(true);
          setStatus('Connected');
        }
      });

      socket.on('webrtc:ice-candidate', async ({ candidate }) => {
        if (pcRef.current && candidate) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate)); } catch (e) {}
        }
      });

      socket.on('peer:left', () => {
        setPeerJoined(false);
        setConnected(false);
        setStatus('Other participant left');
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
      });
    }

    async function createPeerConnection(socket, remoteSocketId, isInitiator) {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      pcRef.current = pc;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => pc.addTrack(track, localStreamRef.current));
      }

      pc.ontrack = (event) => {
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = event.streams[0];
        setConnected(true);
        setStatus('Connected');
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('webrtc:ice-candidate', { candidate: event.candidate, to: remoteSocketId });
        }
      };

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc:offer', { roomCode, offer, to: remoteSocketId });
      }

      return pc;
    }

    setup();

    return () => {
      mounted = false;
      if (localStreamRef.current) localStreamRef.current.getTracks().forEach(t => t.stop());
      if (pcRef.current) pcRef.current.close();
      if (socketRef.current) {
        socketRef.current.emit('room:leave', { roomCode });
        socketRef.current.disconnect();
      }
    };
  }, [roomCode]);

  function toggleMic() {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMicOn(track.enabled); }
  }

  function toggleCam() {
    if (!localStreamRef.current) return;
    const track = localStreamRef.current.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCamOn(track.enabled); }
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="flex justify-between items-center" style={{ marginBottom: 12 }}>
        <div className="flex items-center gap-8">
          <span style={{ width: 8, height: 8, borderRadius: 999, background: connected ? 'var(--teal)' : 'var(--amber)' }} />
          <span className="text-sm" style={{ fontWeight: 600 }}>{status}</span>
        </div>
      </div>

      <div style={videoGrid}>
        <div style={videoTile}>
          <video ref={localVideoRef} autoPlay muted playsInline style={videoEl} />
          <div style={videoLabel}>{userName} (You)</div>
        </div>
        <div style={videoTile}>
          {peerJoined ? (
            <video ref={remoteVideoRef} autoPlay playsInline style={videoEl} />
          ) : (
            <div style={waitingBox}>Waiting for {role === 'doctor' ? 'patient' : 'doctor'} to join…</div>
          )}
          <div style={videoLabel}>{role === 'doctor' ? 'Patient' : 'Doctor'}</div>
        </div>
      </div>

      <div className="flex gap-8 justify-center" style={{ marginTop: 14 }}>
        <button className="btn btn-secondary btn-sm" onClick={toggleMic}>{micOn ? '🎙️ Mute' : '🔇 Unmute'}</button>
        <button className="btn btn-secondary btn-sm" onClick={toggleCam}>{camOn ? '📹 Stop video' : '📷 Start video'}</button>
      </div>
    </div>
  );
}

const videoGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 };
const videoTile = { position: 'relative', background: '#1b1930', borderRadius: 12, overflow: 'hidden', aspectRatio: '4 / 3' };
const videoEl = { width: '100%', height: '100%', objectFit: 'cover' };
const videoLabel = { position: 'absolute', bottom: 8, left: 8, background: 'rgba(0,0,0,0.5)', color: 'white', fontSize: 12, padding: '3px 8px', borderRadius: 6 };
const waitingBox = { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9490b8', fontSize: 13, textAlign: 'center', padding: 20 };
