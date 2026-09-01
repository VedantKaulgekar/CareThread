import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';

import DoctorWorkspaces from './pages/DoctorWorkspaces.jsx';
import WorkspaceDetail from './pages/WorkspaceDetail.jsx';

import PatientWorkspaces from './pages/PatientWorkspaces.jsx';
import PatientWorkspaceView from './pages/PatientWorkspaceView.jsx';

import PatientAnalyticsDashboard from './pages/PatientAnalyticsDashboard.jsx';
import DoctorAnalyticsDashboard from './pages/DoctorAnalyticsDashboard.jsx';

import VisitRoom from './pages/VisitRoom.jsx';
import Settings from './pages/Settings.jsx';

function Protected({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) {
    return <Navigate to={user.role === 'doctor' ? '/doctor' : '/patient'} replace />;
  }
  return children;
}

// A logged-in user should never see the login/signup forms again —
// send them straight to their dashboard instead.
function GuestOnly({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to={user.role === 'doctor' ? '/doctor' : '/patient'} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/signup" element={<GuestOnly><Signup /></GuestOnly>} />

      {/* Doctor */}
      <Route
        path="/doctor"
        element={
          <Protected role="doctor">
            <DoctorWorkspaces />
          </Protected>
        }
      />
      <Route
        path="/doctor/workspaces/:workspaceId"
        element={
          <Protected role="doctor">
            <WorkspaceDetail />
          </Protected>
        }
      />
      <Route
        path="/doctor/analytics"
        element={
          <Protected role="doctor">
            <DoctorAnalyticsDashboard />
          </Protected>
        }
      />

      {/* Patient */}
      <Route
        path="/patient"
        element={
          <Protected role="patient">
            <PatientWorkspaces />
          </Protected>
        }
      />
      <Route
        path="/patient/workspaces/:workspaceId"
        element={
          <Protected role="patient">
            <PatientWorkspaceView />
          </Protected>
        }
      />
      <Route
        path="/patient/analytics"
        element={
          <Protected role="patient">
            <PatientAnalyticsDashboard />
          </Protected>
        }
      />

      {/* Shared */}
      <Route
        path="/room/:code"
        element={
          <Protected>
            <VisitRoom />
          </Protected>
        }
      />
      <Route
        path="/settings"
        element={
          <Protected>
            <Settings />
          </Protected>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
