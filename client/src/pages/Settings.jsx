import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../AuthContext.jsx';
import DashboardNav from '../components/DashboardNav.jsx';

export default function Settings() {
  const { user, token, login } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [specialization, setSpecialization] = useState(user?.specialization || '');
  const [medicalConditions, setMedicalConditions] = useState(user?.medical_conditions || '');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileError('');
    setProfileMsg('');
    setSavingProfile(true);
    try {
      const body = { name, phone };
      if (user?.role === 'doctor') body.specialization = specialization;
      if (user?.role === 'patient') body.medical_conditions = medicalConditions;

      const data = await api('/auth/me', { method: 'PUT', token, body });
      login(token, data.user);
      setProfileMsg('Profile updated.');
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordMsg('');
    setSavingPassword(true);
    try {
      await api('/auth/password', {
        method: 'PUT',
        token,
        body: { currentPassword, newPassword },
      });
      setPasswordMsg('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <>
      <DashboardNav title="Settings" />
      <div style={wrap}>
        <div className="card" style={panel}>
          <h2 style={{ fontSize: 24, marginBottom: 6 }}>Account settings</h2>
          <p className="text-muted text-sm" style={{ marginBottom: 24 }}>
            Update your profile details and password.
          </p>

          <form onSubmit={handleProfileSubmit} style={{ marginBottom: 32 }}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Profile</h3>

            {profileError && <div className="error-box">{profileError}</div>}
            {profileMsg && <div style={successBoxStyle}>{profileMsg}</div>}

            <div className="field">
              <label>Full name</label>
              <input required value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className="field">
              <label>Phone number</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} maxLength={10} />
            </div>

            {user?.role === 'doctor' && (
              <div className="field">
                <label>Specialization</label>
                <input value={specialization} onChange={e => setSpecialization(e.target.value)} />
              </div>
            )}

            {user?.role === 'patient' && (
              <div className="field">
                <label>Existing medical conditions / current medication</label>
                <textarea rows={3} value={medicalConditions} onChange={e => setMedicalConditions(e.target.value)} />
              </div>
            )}

            <button className="btn btn-primary" disabled={savingProfile} style={{ marginTop: 8 }}>
              {savingProfile ? 'Saving…' : 'Save profile'}
            </button>
          </form>

          <form onSubmit={handlePasswordSubmit}>
            <h3 style={{ fontSize: 16, marginBottom: 12 }}>Change password</h3>

            {passwordError && <div className="error-box">{passwordError}</div>}
            {passwordMsg && <div style={successBoxStyle}>{passwordMsg}</div>}

            <div className="field">
              <label>Current password</label>
              <input type="password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
            </div>

            <div className="field">
              <label>New password</label>
              <input type="password" required minLength={6} value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>

            <button className="btn btn-primary" disabled={savingPassword} style={{ marginTop: 8 }}>
              {savingPassword ? 'Updating…' : 'Update password'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

const successBoxStyle = {
  background: '#dcfce7', color: '#166534', border: '1px solid #86efac',
  borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 16,
};

const wrap = {
  minHeight: '100vh', display: 'flex', justifyContent: 'center',
  padding: '48px 24px',
};
const panel = { width: 560, padding: 36, boxShadow: 'var(--shadow-lg)', height: 'fit-content' };