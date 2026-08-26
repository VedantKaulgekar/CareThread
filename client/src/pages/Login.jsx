import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useAuth } from '../AuthContext.jsx';

export default function Login() {
  const [role, setRole] = useState('doctor');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await api('/auth/login', { method: 'POST', body: { email, password, role } });
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
        <h2 style={{ fontSize: 24, marginBottom: 6 }}>Welcome back</h2>
        <p className="text-muted text-sm" style={{ marginBottom: 24 }}>Sign in to continue to your dashboard.</p>

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
            <label>Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label>Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button className="btn btn-primary btn-block" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Signing in…' : `Sign in as ${role === 'doctor' ? 'Doctor' : 'Patient'}`}
          </button>
        </form>

        <p className="text-sm text-muted" style={{ marginTop: 20, textAlign: 'center' }}>
          Don't have an account? <Link to="/signup" style={{ color: 'var(--purple)', fontWeight: 600 }}>Sign up</Link>
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
  padding: 24,
};
const panel = { width: 420, padding: 36, boxShadow: 'var(--shadow-lg)' };
