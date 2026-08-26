import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function DashboardNav({ title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="brand">
          <span className="brand-mark">C</span>CareThread
        </Link>
        <div className="flex items-center gap-16">
          {title && <span className="text-muted text-sm">{title}</span>}
          <div className="flex items-center gap-8">
            <div style={avatarStyle(user)}>{user?.name?.[0]?.toUpperCase() || '?'}</div>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{user?.name}</span>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => { logout(); navigate('/'); }}>Log out</button>
        </div>
      </div>
    </nav>
  );
}

function avatarStyle(user) {
  return {
    width: 30, height: 30, borderRadius: '50%',
    background: user?.role === 'doctor' ? 'var(--purple)' : 'var(--teal)',
    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 13, fontWeight: 700,
  };
}
