import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './style.css';
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
    // Supabase puts the token in the URL hash fragment
    // We need to let Supabase client detect it automatically
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // Session is ready — user can now set new password
        setSessionReady(true);
      }
    });

    // Also check if session already exists from the hash
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSessionReady(true);
      } else if (!window.location.hash.includes('access_token')) {
        showMessage('Invalid reset link', true);
        setTimeout(() => navigate('/login'), 2000);
      }
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword)
      return showMessage('Please fill in all fields', true);
    if (newPassword.length < 6)
      return showMessage('Password must be at least 6 characters', true);
    if (newPassword !== confirmPassword)
      return showMessage('Passwords do not match', true);

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        showMessage(error.message || 'Failed to reset password', true);
      } else {
        showMessage('Password reset successfully! Redirecting to sign in...');
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
    <div className="login-page">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />

      {message.show && (
        <div className={`flo-toast ${message.isError ? 'flo-toast--error' : 'flo-toast--success'}`}>
          <span className="flo-toast-icon">{message.isError ? '✕' : '✓'}</span>
          {message.text}
        </div>
      )}

      <div className="forgot-card">
        <h1>
          <i className="fa-solid fa-key" style={{ marginRight: 10, color: 'var(--forest)' }} />
          Reset Password
        </h1>
        <div className="divider" />

        {!sessionReady ? (
          <p>Verifying reset link...</p>
        ) : (
          <>
            <p>Enter your new password below.</p>
            <form className="reset-form" onSubmit={handleSubmit}>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="New Password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  disabled={loading}
                  style={{ paddingRight: 44 }}
                />
                <i
                  className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}
                  onClick={() => setShowPassword(v => !v)}
                  style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: 15, color: 'var(--ink)' }}
                />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                disabled={loading}
              />
              <button type="submit" disabled={loading}>
                {loading ? 'Resetting...' : 'Reset Password →'}
              </button>
              <button type="button" onClick={() => navigate('/login')} disabled={loading}
                style={{ background: 'var(--nb-white)', color: 'var(--nb-black)' }}>
                ← Back to Sign In
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}