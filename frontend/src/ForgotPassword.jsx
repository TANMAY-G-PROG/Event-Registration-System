import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './style.css';
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
        redirectTo: `${window.location.origin}/reset-password`
      });
      if (error) {
        showMessage(error.message || 'Something went wrong. Please try again.', true);
      } else {
        showMessage('Link sent! Check your email (and Spam folder).');
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
    <div className="login-page">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />

      {/* ── TOAST MESSAGE ── */}
      {message.show && (
        <div className={`flo-toast ${message.isError ? "flo-toast--error" : "flo-toast--success"}`}>
          <span className="flo-toast-icon">{message.isError ? "✕" : "✓"}</span>
          {message.text}
        </div>
      )}

      <div className="forgot-card">
        <h1><i className="fa-solid fa-lock" style={{ marginRight: 10, color: 'var(--nb-blue)' }}></i>Forgot Password?</h1>
        <div className="divider"></div>
        <p>Enter your registered email address and we'll send you a link to reset your password.</p>
        <form className="forgot-form" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            autoComplete="email"
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Send Reset Link →'}
          </button>
          <button type="button" onClick={() => navigate('/')} disabled={loading} style={{ background: 'var(--nb-white)', color: 'var(--nb-black)' }}>
            ← Back to Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
