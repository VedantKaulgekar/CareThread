import React from 'react';
import {
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import { useAuth } from './AuthContext.jsx';

/* =========================================================
   PAGES
========================================================= */

import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';

import DoctorDashboard from './pages/DoctorDashboard.jsx';
import Workspaces from './pages/Workspaces.jsx';
import Patients from './pages/Patients.jsx';
import Profile from './pages/Profile.jsx';

import PatientDashboard from './pages/PatientDashboard.jsx';
import VisitRoom from './pages/VisitRoom.jsx';


/* =========================================================
   PROTECTED ROUTE
========================================================= */

function Protected({ role, children }) {
  const { user } = useAuth();

  /*
   * ---------------------------------------------------------
   * USER NOT LOGGED IN
   * ---------------------------------------------------------
   */

  if (!user) {
    const loginRole = role || 'doctor';

    return (
      <Navigate
        to={`/login?role=${loginRole}`}
        replace
      />
    );
  }


  /*
   * ---------------------------------------------------------
   * USER LOGGED IN BUT WRONG ROLE
   * ---------------------------------------------------------
   */

  if (
    role &&
    user.role !== role
  ) {
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


  /*
   * ---------------------------------------------------------
   * AUTHORIZED
   * ---------------------------------------------------------
   */

  return children;
}


/* =========================================================
   APP
========================================================= */

export default function App() {
  return (
    <Routes>


      {/* =====================================================
          LANDING PAGE
      ===================================================== */}

      <Route
        path="/"
        element={
          <Landing />
        }
      />


      {/* =====================================================
          LOGIN
      ===================================================== */}

      <Route
        path="/login"
        element={
          <Login />
        }
      />


      {/* =====================================================
          SIGNUP
      ===================================================== */}

      <Route
        path="/signup"
        element={
          <Signup />
        }
      />


      {/* =====================================================
          DOCTOR DASHBOARD
      ===================================================== */}

      <Route
        path="/doctor"
        element={
          <Protected role="doctor">
            <DoctorDashboard />
          </Protected>
        }
      />


      {/* =====================================================
          MY WORKSPACES
      =====================================================

          This page handles:

          • Create Workspace
          • View existing Workspaces
          • Workspace name
          • Visit type
          • Frequency
          • Workspace management
      ===================================================== */}

      <Route
        path="/workspaces"
        element={
          <Protected role="doctor">
            <Workspaces />
          </Protected>
        }
      />


      {/* =====================================================
          PATIENTS
      =====================================================

          Doctor can:

          • View patient list
          • Search patients
          • Select a patient
          • View detailed patient information
          • View vitals
          • View medical information
          • View visit history
      ===================================================== */}

      <Route
        path="/patients"
        element={
          <Protected role="doctor">
            <Patients />
          </Protected>
        }
      />


      {/* =====================================================
          DOCTOR PROFILE
      =====================================================

          Doctor can:

          • View profile
          • View professional information
          • Edit profile
          • Save profile changes
      ===================================================== */}

      <Route
        path="/profile"
        element={
          <Protected role="doctor">
            <Profile />
          </Protected>
        }
      />


      {/* =====================================================
          PATIENT DASHBOARD
      ===================================================== */}

      <Route
        path="/patient"
        element={
          <Protected role="patient">
            <PatientDashboard />
          </Protected>
        }
      />


      {/* =====================================================
          VISIT ROOM
      =====================================================

          Both Doctor and Patient can enter
          a visit room after authentication.
      ===================================================== */}

      <Route
        path="/room/:code"
        element={
          <Protected>
            <VisitRoom />
          </Protected>
        }
      />


      {/* =====================================================
          UNKNOWN ROUTE
      ===================================================== */}

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