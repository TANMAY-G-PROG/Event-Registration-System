import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false, show: false });

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError, show: true });
    setTimeout(() => setMessage(prev => ({ ...prev, show: false })), 5000);
  };

  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      } else if (!window.location.hash.includes('access_token')) {
        showMessage('Invalid or expired link.', true);
        setTimeout(() => navigate('/login'), 2000);
      }
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) return showMessage('Please fill in all fields.', true);
    if (newPassword.length < 6) return showMessage('Password must be at least 6 characters.', true);
    if (newPassword !== confirmPassword) return showMessage('Passwords do not match.', true);

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showMessage(error.message || 'Reset failed. Please try again.', true);
      } else {
        showMessage('Password reset! Redirecting...');
        setTimeout(() => {
          supabase.auth.signOut();
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          navigate('/login');
        }, 2000);
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
          font-family: Arial, sans-serif;
        }

        .rp-card {
          width: 100%;
          max-width: 420px;
          background: #f5f0e4;
          border: 3px solid #111;
          box-shadow: 7px 7px 0 #111;
          box-sizing: border-box;
        }

        /* HEADER */
        .rp-header {
          background: #2563eb;
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
          opacity: 0.6;
          margin-bottom: 6px;
        }
        .rp-title {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 42px;
          letter-spacing: 0.04em;
          color: #fff;
          line-height: 1;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .rp-title i {
          font-size: 30px;
          color: #f5a623;
        }

        /* BODY */
        .rp-body {
          padding: 26px 28px 0;
        }
        .rp-desc {
          font-size: 14px;
          line-height: 1.65;
          color: #444;
          margin: 0 0 24px;
        }

        /* VERIFYING STATE */
        .rp-verifying {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #fff8e6;
          border: 2px solid #f5a623;
          padding: 14px 16px;
          margin-bottom: 24px;
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #7a5c00;
        }
        .rp-spinner {
          width: 16px;
          height: 16px;
          border: 2.5px solid #f5a623;
          border-top-color: transparent;
          border-radius: 50%;
          animation: rp-spin 0.7s linear infinite;
          flex-shrink: 0;
        }
        @keyframes rp-spin {
          to { transform: rotate(360deg); }
        }

        /* FORM */
        .rp-form {
          padding: 0 28px 28px;
        }

        .rp-field {
          position: relative;
          margin-bottom: 14px;
        }
        .rp-input {
          width: 100%;
          padding: 13px 44px 13px 14px;
          font-size: 14px;
          font-family: Arial, sans-serif;
          border: 2.5px solid #aaa;
          background: #ede8dc;
          color: #111;
          box-sizing: border-box;
          outline: none;
          border-radius: 0;
          transition: border-color 0.15s;
        }
        .rp-input:focus {
          border-color: #111;
        }
        .rp-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .rp-eye {
          position: absolute;
          right: 14px;
          top: 50%;
          transform: translateY(-50%);
          cursor: pointer;
          font-size: 14px;
          color: #777;
          transition: color 0.15s;
        }
        .rp-eye:hover { color: #111; }

        /* PASSWORD STRENGTH */
        .rp-strength {
          margin: -8px 0 14px;
          display: flex;
          gap: 4px;
          align-items: center;
        }
        .rp-strength-bar {
          height: 3px;
          flex: 1;
          background: #ddd;
          border: 1px solid #bbb;
          transition: background 0.2s;
        }
        .rp-strength-bar.active-weak   { background: #e53e3e; border-color: #e53e3e; }
        .rp-strength-bar.active-medium { background: #f5a623; border-color: #f5a623; }
        .rp-strength-bar.active-strong { background: #38a169; border-color: #38a169; }
        .rp-strength-label {
          font-family: 'Space Mono', monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #999;
          min-width: 48px;
          text-align: right;
        }
        .rp-strength-label.weak   { color: #e53e3e; }
        .rp-strength-label.medium { color: #f5a623; }
        .rp-strength-label.strong { color: #38a169; }

        /* MATCH INDICATOR */
        .rp-match {
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          margin: -8px 0 14px;
          padding: 6px 10px;
          border: 2px solid;
        }
        .rp-match.ok  { color: #38a169; border-color: #38a169; background: #f0fff4; }
        .rp-match.bad { color: #e53e3e; border-color: #e53e3e; background: #fff5f5; }

        .rp-btn-primary {
          width: 100%;
          padding: 15px;
          background: #111;
          color: #f5f0e4;
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          border: 3px solid #111;
          box-shadow: 5px 5px 0 #2563eb;
          cursor: pointer;
          box-sizing: border-box;
          margin-bottom: 12px;
          transition: box-shadow 0.1s, transform 0.1s;
        }
        .rp-btn-primary:hover:not(:disabled) {
          box-shadow: 3px 3px 0 #2563eb;
          transform: translate(2px, 2px);
        }
        .rp-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .rp-btn-secondary {
          width: 100%;
          padding: 15px;
          background: #f5f0e4;
          color: #111;
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          border: 3px solid #111;
          cursor: pointer;
          box-sizing: border-box;
          transition: background 0.1s;
        }
        .rp-btn-secondary:hover:not(:disabled) { background: #e8e0d0; }
        .rp-btn-secondary:disabled { opacity: 0.6; cursor: not-allowed; }

        /* TOAST */
        .rp-toast {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          padding: 12px 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          border: 3px solid #111;
          box-shadow: 4px 4px 0 #111;
          white-space: nowrap;
          max-width: 90vw;
        }
        .rp-toast--success { background: #d4edda; color: #155724; }
        .rp-toast--error   { background: #f8d7da; color: #721c24; }

        @media (max-width: 480px) {
          .rp-header { padding: 18px 20px 16px; }
          .rp-title  { font-size: 34px; }
          .rp-body   { padding: 20px 20px 0; }
          .rp-form   { padding: 0 20px 24px; }
        }
      `}</style>

      {/* TOAST */}
      {message.show && (
        <div className={`rp-toast ${message.isError ? 'rp-toast--error' : 'rp-toast--success'}`}>
          <span>{message.isError ? '✕' : '✓'}</span>
          {message.text}
        </div>
      )}

      <div className="rp-page">
        <div className="rp-card">

          {/* HEADER */}
          <div className="rp-header">
            <div className="rp-eyebrow">// Account Security</div>
            <div className="rp-title">
              <i className="fa-solid fa-key"></i>
              SET NEW<br/>PASSWORD
            </div>
          </div>

          {!sessionReady ? (
            <div className="rp-body">
              <div className="rp-verifying">
                <div className="rp-spinner"></div>
                Verifying reset link...
              </div>
            </div>
          ) : (
            <>
              <div className="rp-body">
                <p className="rp-desc">Choose a strong new password for your FLO account.</p>
              </div>

              <form className="rp-form" onSubmit={handleSubmit}>
                {/* NEW PASSWORD */}
                <div className="rp-field">
                  <input
                    className="rp-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="New Password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    disabled={loading}
                  />
                  <i
                    className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} rp-eye`}
                    onClick={() => setShowPassword(v => !v)}
                  />
                </div>

                {/* STRENGTH METER */}
                {newPassword.length > 0 && (() => {
                  const len = newPassword.length;
                  const hasUpper = /[A-Z]/.test(newPassword);
                  const hasNum   = /[0-9]/.test(newPassword);
                  const hasSpec  = /[^A-Za-z0-9]/.test(newPassword);
                  const score = (len >= 8 ? 1 : 0) + (hasUpper ? 1 : 0) + (hasNum ? 1 : 0) + (hasSpec ? 1 : 0);
                  const level = score <= 1 ? 'weak' : score <= 2 ? 'medium' : 'strong';
                  const labels = { weak: 'Weak', medium: 'Fair', strong: 'Strong' };
                  const activeClass = `active-${level}`;
                  return (
                    <div className="rp-strength">
                      {[0,1,2].map(i => (
                        <div key={i} className={`rp-strength-bar ${
                          (level === 'weak' && i === 0) ||
                          (level === 'medium' && i <= 1) ||
                          (level === 'strong') ? activeClass : ''
                        }`}/>
                      ))}
                      <span className={`rp-strength-label ${level}`}>{labels[level]}</span>
                    </div>
                  );
                })()}

                {/* CONFIRM PASSWORD */}
                <div className="rp-field">
                  <input
                    className="rp-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    disabled={loading}
                  />
                </div>

                {/* MATCH INDICATOR */}
                {confirmPassword.length > 0 && (
                  <div className={`rp-match ${newPassword === confirmPassword ? 'ok' : 'bad'}`}>
                    {newPassword === confirmPassword ? '✓ Passwords match' : '✕ Passwords do not match'}
                  </div>
                )}

                <button type="submit" className="rp-btn-primary" disabled={loading}>
                  {loading ? 'Resetting...' : '→ Reset Password'}
                </button>
                <button
                  type="button"
                  className="rp-btn-secondary"
                  onClick={() => navigate('/login')}
                  disabled={loading}
                >
                  ← Back to Sign In
                </button>
              </form>
            </>
          )}

        </div>
      </div>
    </>
  );
}
