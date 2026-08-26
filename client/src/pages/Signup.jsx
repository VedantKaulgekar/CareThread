import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useAuth } from '../AuthContext.jsx';

const initialForm = {
  name: '', email: '', password: '',
  age: '', gender: '', phone: '', medical_conditions: '',
  specialization: '',
};

export default function Signup() {
  const [role, setRole] = useState('patient');
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/signup', { method: 'POST', body: { ...form, role } });
      login(data.token, data.user);
      navigate(role === 'doctor' ? '/doctor' : '/patient');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={wrap}>
      <div className="card" style={panel}>
        <Link to="/" className="brand" style={{ marginBottom: 24, display: 'flex' }}>
          <span className="brand-mark">C</span>CareThread
        </Link>
        <h2 style={{ fontSize: 24, marginBottom: 6 }}>Create your account</h2>
        <p className="text-muted text-sm" style={{ marginBottom: 24 }}>
          {role === 'patient'
            ? 'A few details help your doctor prepare for your visits.'
            : 'Set up your investigator profile to start hosting Visit Rooms.'}
        </p>

        <div className="role-toggle">
          <div className={`role-option ${role === 'doctor' ? 'active' : ''}`} onClick={() => setRole('doctor')}>
            <span className="icon">🩺</span>
            <span className="label">Doctor</span>
          </div>
          <div className={`role-option ${role === 'patient' ? 'active' : ''}`} onClick={() => setRole('patient')}>
            <span className="icon">🧑</span>
            <span className="label">Patient</span>
          </div>
        </div>

        {error && <div className="error-box">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label>Full name</label>
            <input required value={form.name} onChange={e => update('name', e.target.value)} placeholder="Jordan Rivera" />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Email</label>
              <input type="email" required value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" required minLength={6} value={form.password} onChange={e => update('password', e.target.value)} placeholder="At least 6 characters" />
            </div>
          </div>

          {role === 'doctor' ? (
            <div className="field">
              <label>Specialization</label>
              <input value={form.specialization} onChange={e => update('specialization', e.target.value)} placeholder="e.g. Clinical Trial Investigator — Oncology" />
            </div>
          ) : (
            <>
              <div className="field-row">
                <div className="field">
                  <label>Age</label>
                  <input type="number" min="0" value={form.age} onChange={e => update('age', e.target.value)} placeholder="34" />
                </div>
                <div className="field">
                  <label>Gender</label>
                  <select value={form.gender} onChange={e => update('gender', e.target.value)}>
                    <option value="">Select</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Other</option>
                    <option>Prefer not to say</option>
                  </select>
                </div>
              </div>
              <div className="field">
                <label>Phone number</label>
                <input value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+1 555 000 1234" />
              </div>
              <div className="field">
                <label>Existing medical conditions / current medication</label>
                <textarea rows={3} value={form.medical_conditions} onChange={e => update('medical_conditions', e.target.value)} placeholder="e.g. Type 2 diabetes, currently on Metformin" />
              </div>
            </>
          )}

          <button className="btn btn-primary btn-block" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Creating account…' : `Create ${role} account`}
          </button>
        </form>

        <p className="text-sm text-muted" style={{ marginTop: 20, textAlign: 'center' }}>
          Already have an account? <Link to="/login" style={{ color: 'var(--purple)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const wrap = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'radial-gradient(900px 500px at 20% 0%, #EEEDFE 0%, transparent 55%), radial-gradient(900px 500px at 100% 100%, #E1F5EE 0%, transparent 55%)',
  padding: '40px 24px',
};
const panel = { width: 460, padding: 36, boxShadow: 'var(--shadow-lg)' };
