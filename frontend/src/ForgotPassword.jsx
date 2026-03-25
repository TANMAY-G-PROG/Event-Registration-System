import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false, show: false });

  const API_BASE = import.meta.env.VITE_API_URL || '';

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError, show: true });
    setTimeout(() => setMessage(prev => ({ ...prev, show: false })), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return showMessage('Please enter your email address', true);
    if (!/\S+@\S+\.\S+/.test(email)) return showMessage('Please enter a valid email address', true);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showMessage('Reset link sent! Check your inbox and spam folder.');
        setEmail('');
        setTimeout(() => navigate('/login'), 3000);
      } else {
        showMessage(data.error || 'Something went wrong. Please try again.', true);
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

        .fp-page {
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

        .fp-card {
          width: 100%;
          max-width: 420px;
          background: #f5f0e4;
          border: 3px solid #111;
          box-shadow: 7px 7px 0 #111;
          box-sizing: border-box;
        }

        .fp-header {
          background: #f5a623;
          border-bottom: 3px solid #111;
          padding: 22px 28px 18px;
        }
        .fp-eyebrow {
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #111;
          opacity: 0.7;
          margin: 0 0 6px;
        }
        .fp-title {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 2.4rem;
          color: #111;
          margin: 0;
          line-height: 1;
        }

        .fp-body { padding: 28px; }

        .fp-desc {
          font-family: 'Space Mono', monospace;
          font-size: 12px;
          color: #333;
          line-height: 1.6;
          margin: 0 0 24px;
        }

        .fp-label {
          display: block;
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #111;
          margin-bottom: 8px;
        }
        .fp-input {
          width: 100%;
          padding: 12px 14px;
          border: 2.5px solid #111;
          background: #fff;
          font-family: 'Space Mono', monospace;
          font-size: 13px;
          color: #111;
          box-sizing: border-box;
          outline: none;
          transition: box-shadow 0.15s;
        }
        .fp-input:focus { box-shadow: 3px 3px 0 #111; }

        .fp-btn {
          width: 100%;
          padding: 14px;
          margin-top: 20px;
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
          transition: background 0.15s, color 0.15s, transform 0.1s;
        }
        .fp-btn:hover:not(:disabled) { background: #333; transform: translateY(-1px); }
        .fp-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .fp-back {
          display: block;
          text-align: center;
          margin-top: 16px;
          font-family: 'Space Mono', monospace;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #111;
          text-decoration: none;
          opacity: 0.6;
          cursor: pointer;
          background: none;
          border: none;
          width: 100%;
        }
        .fp-back:hover { opacity: 1; text-decoration: underline; }

        .fp-toast {
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
        .fp-toast--success { background: #c8f5c8; color: #111; }
        .fp-toast--error { background: #ffd6d6; color: #111; }

        .fp-spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(245,240,228,0.3);
          border-top-color: #f5f0e4;
          border-radius: 50%;
          animation: fp-spin 0.7s linear infinite;
        }
        @keyframes fp-spin { to { transform: rotate(360deg); } }
      `}</style>

      {message.show && (
        <div className={`fp-toast ${message.isError ? 'fp-toast--error' : 'fp-toast--success'}`}>
          <span>{message.isError ? '✕' : '✓'}</span>
          {message.text}
        </div>
      )}

      <div className="fp-page">
        <div className="fp-card">
          <div className="fp-header">
            <p className="fp-eyebrow">Account Recovery</p>
            <h1 className="fp-title">Forgot Password</h1>
          </div>
          <div className="fp-body">
            <p className="fp-desc">
              Enter the email address linked to your FLO account. We'll send you a reset link.
            </p>
            <form onSubmit={handleSubmit}>
              <label className="fp-label">Email Address</label>
              <input
                type="email"
                className="fp-input"
                placeholder="you@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
              <button type="submit" className="fp-btn" disabled={loading}>
                {loading ? <span className="fp-spinner" /> : <>Send Reset Link <span>→</span></>}
              </button>
            </form>
            <button className="fp-back" onClick={() => navigate('/login')}>
              ← Back to Sign In
            </button>
          </div>
        </div>
      </div>
    </>
  );
}