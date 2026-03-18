import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './profile.css';
import { apiFetch } from './api.js';

export default function Profile() {
  const navigate = useNavigate();
  const [userInfo, setUserInfo] = useState({ userName: '', userUSN: '', email: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await apiFetch('/api/me', { method: 'GET' });
        if (!res.ok) { navigate('/'); return; }
        const data = await res.json();
        setUserInfo({
          userName: data.userName || '',
          userUSN:  data.userUSN  || '',
          email:    data.email    || '',
        });
      } catch { navigate('/'); }
      finally { setLoading(false); }
    };
    fetchUser();
  }, []);

  const handleLogout = async () => {
    try { await apiFetch('/api/signout', { method: 'POST' }); } catch {}
    finally { localStorage.removeItem('token'); navigate('/'); }
  };

  const initials = userInfo.userName
    ? userInfo.userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div className="profile-page">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />

      {/* NAV */}
      <nav className="prof-nav">
        <button className="prof-back-btn" onClick={() => navigate('/events')}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
        <span className="prof-nav-title">My Profile</span>
        <div style={{width: 80}}></div>
      </nav>

      <div className="prof-content">
        {loading ? (
          <div className="prof-loading">
            <div className="prof-spinner"></div>
            <p>Loading...</p>
          </div>
        ) : (
          <>
            {/* AVATAR CARD */}
            <div className="prof-avatar-card">
              <div className="prof-avatar">{initials}</div>
              <div className="prof-avatar-info">
                <h1 className="prof-name">{userInfo.userName || 'User'}</h1>
                <span className="prof-usn-badge">{userInfo.userUSN}</span>
              </div>
            </div>

            {/* INFO CARD */}
            <div className="prof-info-card">
              <div className="prof-info-header">
                <span className="prof-info-header-label">Account Details</span>
              </div>

              <div className="prof-info-row">
                <div className="prof-info-icon"><i className="fas fa-user"></i></div>
                <div className="prof-info-body">
                  <span className="prof-info-label">Full Name</span>
                  <span className="prof-info-value">{userInfo.userName || '—'}</span>
                </div>
              </div>

              <div className="prof-info-row">
                <div className="prof-info-icon"><i className="fas fa-id-card"></i></div>
                <div className="prof-info-body">
                  <span className="prof-info-label">University Serial No.</span>
                  <span className="prof-info-value mono">{userInfo.userUSN || '—'}</span>
                </div>
              </div>

              <div className="prof-info-row">
                <div className="prof-info-icon"><i className="fas fa-envelope"></i></div>
                <div className="prof-info-body">
                  <span className="prof-info-label">Email Address</span>
                  <span className="prof-info-value">{userInfo.email || '—'}</span>
                </div>
              </div>
            </div>

            {/* LOGOUT */}
            <button className="prof-logout-btn" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt"></i>
              Sign Out
            </button>
          </>
        )}
      </div>
    </div>
  );
}