import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false, show: false });

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
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        showMessage(error.message || 'Something went wrong. Please try again.', true);
      } else {
        showMessage('Reset link sent! Check your inbox and spam folder.');
        setEmail('');
        setTimeout(() => navigate('/login'), 3000);
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

        /* HEADER */
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
          opacity: 0.6;
          margin-bottom: 6px;
        }
        .fp-title {
          font-family: 'Bebas Neue', Impact, sans-serif;
          font-size: 42px;
          letter-spacing: 0.04em;
          color: #111;
          line-height: 1;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .fp-title i {
          font-size: 32px;
          color: #2563eb;
        }

        /* BODY */
        .fp-body {
          padding: 26px 28px 0;
        }
        .fp-desc {
          font-size: 14px;
          line-height: 1.65;
          color: #444;
          margin: 0 0 16px;
        }

        /* SPAM NOTICE */
        .fp-spam {
          background: #fff;
          border: 3px solid #111;
          border-left: 6px solid #e53e3e;
          box-shadow: 4px 4px 0 #111;
          padding: 13px 15px;
          margin-bottom: 26px;
          display: flex;
          gap: 11px;
          align-items: flex-start;
        }
        .fp-spam-icon {
          font-size: 20px;
          flex-shrink: 0;
          margin-top: 1px;
        }
        .fp-spam-text {
          font-size: 13px;
          line-height: 1.55;
          color: #111;
        }
        .fp-spam-label {
          display: block;
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #e53e3e;
          margin-bottom: 4px;
        }

        /* FORM */
        .fp-form {
          padding: 0 28px 28px;
        }
        .fp-input {
          width: 100%;
          padding: 13px 14px;
          font-size: 14px;
          font-family: Arial, sans-serif;
          border: 2.5px solid #aaa;
          background: #ede8dc;
          color: #111;
          box-sizing: border-box;
          margin-bottom: 14px;
          outline: none;
          border-radius: 0;
          transition: border-color 0.15s;
        }
        .fp-input:focus {
          border-color: #111;
        }
        .fp-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .fp-btn-primary {
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
          box-shadow: 5px 5px 0 #f5a623;
          cursor: pointer;
          box-sizing: border-box;
          margin-bottom: 12px;
          transition: box-shadow 0.1s, transform 0.1s;
        }
        .fp-btn-primary:hover:not(:disabled) {
          box-shadow: 3px 3px 0 #f5a623;
          transform: translate(2px, 2px);
        }
        .fp-btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .fp-btn-secondary {
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
        .fp-btn-secondary:hover:not(:disabled) {
          background: #e8e0d0;
        }
        .fp-btn-secondary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* TOAST */
        .fp-toast {
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
        .fp-toast--success {
          background: #d4edda;
          color: #155724;
        }
        .fp-toast--error {
          background: #f8d7da;
          color: #721c24;
        }

        @media (max-width: 480px) {
          .fp-header { padding: 18px 20px 16px; }
          .fp-title { font-size: 34px; }
          .fp-body { padding: 20px 20px 0; }
          .fp-form { padding: 0 20px 24px; }
        }
      `}</style>

      {/* TOAST */}
      {message.show && (
        <div className={`fp-toast ${message.isError ? 'fp-toast--error' : 'fp-toast--success'}`}>
          <span>{message.isError ? '✕' : '✓'}</span>
          {message.text}
        </div>
      )}

      <div className="fp-page">
        <div className="fp-card">

          {/* HEADER */}
          <div className="fp-header">
            <div className="fp-eyebrow">// Account Security</div>
            <div className="fp-title">
              <i className="fa-solid fa-lock"></i>
              FORGOT<br/>PASSWORD?
            </div>
          </div>

          {/* BODY */}
          <div className="fp-body">
            <p className="fp-desc">
              Enter your registered email and we'll send you a link to reset your password.
            </p>

            {/* SPAM NOTICE */}
            <div className="fp-spam">
              <span className="fp-spam-icon">📬</span>
              <div className="fp-spam-text">
                <span className="fp-spam-label">⚠ Check Spam / Junk folder</span>
                If you don't see the email in your inbox, check <strong>Spam</strong> or <strong>Junk</strong>. Mark it as <strong>"Not Spam"</strong> so future emails reach you.
              </div>
            </div>
          </div>

          {/* FORM */}
          <form className="fp-form" onSubmit={handleSubmit}>
            <input
              className="fp-input"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email"
            />
            <button type="submit" className="fp-btn-primary" disabled={loading}>
              {loading ? 'Sending...' : '→ Send Reset Link'}
            </button>
            <button
              type="button"
              className="fp-btn-secondary"
              onClick={() => navigate('/')}
              disabled={loading}
            >
              ← Back to Sign In
            </button>
          </form>

        </div>
      </div>
    </>
  );
}
