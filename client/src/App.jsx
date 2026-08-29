import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';

import DoctorDashboard from './pages/DoctorDashboard.jsx';
import PatientDashboard from './pages/PatientDashboard.jsx';
import VisitRoom from './pages/VisitRoom.jsx';

import Workspaces from './pages/Workspaces.jsx';
import Patients from './pages/Patients.jsx';
import Profile from './pages/Profile.jsx';

import Settings from './pages/Settings.jsx';


function Protected({ role, children }) {
  const { user } = useAuth();

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  if (role && user.role !== role) {
    return (
      <Navigate
        to={
          user.role === 'doctor'
            ? '/doctor'
            : '/patient'
        }
        replace
      />
    );
  }

  return children;
}


export default function App() {
  return (
    <Routes>

      {/* Landing */}
      <Route
        path="/"
        element={<Landing />}
      />

      {/* Login */}
      <Route
        path="/login"
        element={<Login />}
      />

      {/* Signup */}
      <Route
        path="/signup"
        element={<Signup />}
      />

      {/* Doctor Dashboard */}
      <Route
        path="/doctor"
        element={
          <Protected role="doctor">
            <DoctorDashboard />
          </Protected>
        }
      />

      {/* Workspaces */}
      <Route
        path="/workspaces"
        element={
          <Protected role="doctor">
            <Workspaces />
          </Protected>
        }
      />

      {/* Patients */}
      <Route
        path="/patients"
        element={
          <Protected role="doctor">
            <Patients />
          </Protected>
        }
      />

      {/* Profile */}
      <Route
        path="/profile"
        element={
          <Protected role="doctor">
            <Profile />
          </Protected>
        }
      />

      {/* Settings */}
      <Route
        path="/settings"
        element={
          <Protected>
            <Settings />
          </Protected>
        }
      />

      {/* Patient Dashboard */}
      <Route
        path="/patient"
        element={
          <Protected role="patient">
            <PatientDashboard />
          </Protected>
        }
      />

      {/* Visit Room */}
      <Route
        path="/room/:code"
        element={
          <Protected>
            <VisitRoom />
          </Protected>
        }
      />

      {/* Unknown */}
      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  );
}