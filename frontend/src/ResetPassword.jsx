import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export default function ResetPassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false, show: false });

  const API_BASE = import.meta.env.VITE_API_URL || '';

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError, show: true });
    setTimeout(() => setMessage(prev => ({ ...prev, show: false })), 5000);
  };

  useEffect(() => {
    // Backend sends reset email with link: /reset-password?token=xxx
    const params = new URLSearchParams(location.search);
    const t = params.get('token');
    if (!t) {
      showMessage('Invalid or expired reset link.', true);
      setTimeout(() => navigate('/login'), 2500);
    } else {
      setToken(t);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) return showMessage('Please fill in all fields.', true);
    if (newPassword.length < 6) return showMessage('Password must be at least 6 characters.', true);
    if (newPassword !== confirmPassword) return showMessage('Passwords do not match.', true);

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showMessage('Password reset! Redirecting to sign in...');
        localStorage.removeItem('token');
        setTimeout(() => navigate('/login'), 2500);
      } else {
        showMessage(data.error || 'Reset failed. Please request a new link.', true);
      }
    } catch {
      showMessage('Network error. Please try again.', true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"
      />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Bebas+Neue&display=swap');

        .rp-page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: #e8e0d0;
          padding: 24px 16px;
          box-sizing: border-box;
        }
        .rp-card {
          width: 100%;
          max-width: 420px;
          background: #f5f0e4;
          border: 3px solid #111;
          box-shadow: 7px 7px 0 #111;
          box-sizing: border-box;
        }
        .rp-header {
          background: #5b8def;
          border-bottom: 3px solid #111;
          padding: 22px 28px 18px;
        }
        .rp-eyebrow {
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #fff;
          opacity: 0.8;
          margin: 0 0 6px;
        }
        .rp-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 2.4rem;
          color: #fff;
          margin: 0;
          line-height: 1;
        }
        .rp-body { padding: 28px; }
        .rp-label {
          display: block;
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #111;
          margin-bottom: 8px;
          margin-top: 16px;
        }
        .rp-input-wrap { position: relative; }
        .rp-input {
          width: 100%;
          padding: 12px 50px 12px 14px;
          border: 2.5px solid #111;
          background: #fff;
          font-family: 'Space Mono', monospace;
          font-size: 13px;
          color: #111;
          box-sizing: border-box;
          outline: none;
          transition: box-shadow 0.15s;
        }
        .rp-input:focus { box-shadow: 3px 3px 0 #111; }
        .rp-toggle {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          opacity: 0.5;
          padding: 4px;
        }
        .rp-toggle:hover { opacity: 1; }
        .rp-btn {
          width: 100%;
          padding: 14px;
          margin-top: 24px;
          background: #111;
          color: #f5f0e4;
          border: 2.5px solid #111;
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          transition: background 0.15s, transform 0.1s;
        }
        .rp-btn:hover:not(:disabled) { background: #333; transform: translateY(-1px); }
        .rp-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .rp-back {
          display: block;
          text-align: center;
          margin-top: 16px;
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #111;
          opacity: 0.6;
          cursor: pointer;
          background: none;
          border: none;
          width: 100%;
        }
        .rp-back:hover { opacity: 1; text-decoration: underline; }
        .rp-toast {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          padding: 12px 20px;
          border: 2.5px solid #111;
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 4px 4px 0 #111;
          max-width: 90vw;
        }
        .rp-toast--success { background: #c8f5c8; color: #111; }
        .rp-toast--error { background: #ffd6d6; color: #111; }
        .rp-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(245,240,228,0.3);
          border-top-color: #f5f0e4;
          border-radius: 50%;
          animation: rp-spin 0.7s linear infinite;
        }
        @keyframes rp-spin { to { transform: rotate(360deg); } }
      `}</style>

      {message.show && (
        <div className={`rp-toast ${message.isError ? 'rp-toast--error' : 'rp-toast--success'}`}>
          <span>{message.isError ? '✕' : '✓'}</span>
          {message.text}
        </div>
      )}

      <div className="rp-page">
        <div className="rp-card">
          <div className="rp-header">
            <p className="rp-eyebrow">Account Recovery</p>
            <h1 className="rp-title">Reset Password</h1>
          </div>
          <div className="rp-body">
            <form onSubmit={handleSubmit}>
              <label className="rp-label">New Password</label>
              <div className="rp-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="rp-input"
                  placeholder="Min. 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading || !token}
                />
                <button type="button" className="rp-toggle" onClick={() => setShowPassword(s => !s)}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              <label className="rp-label">Confirm Password</label>
              <div className="rp-input-wrap">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="rp-input"
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading || !token}
                />
              </div>

              <button type="submit" className="rp-btn" disabled={loading || !token}>
                {loading ? <span className="rp-spinner" /> : <>Reset Password <span>→</span></>}
              </button>
            </form>
            <button className="rp-back" onClick={() => navigate('/login')}>
              ← Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </>
  );
}