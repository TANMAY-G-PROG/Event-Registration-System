import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './style.css';
import { apiFetch } from './api.js';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false, show: false });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!token) { showMessage('Invalid reset link', true); setTimeout(() => navigate('/'), 2000); }
  }, [token, navigate]);

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError, show: true });
    setTimeout(() => setMessage(prev => ({ ...prev, show: false })), 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) return showMessage('Please fill in all fields', true);
    if (newPassword.length < 6) return showMessage('Password must be at least 6 characters', true);
    if (newPassword !== confirmPassword) return showMessage('Passwords do not match', true);
    setLoading(true);
    try {
      const response = await apiFetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword })
      });
      const data = await response.json();
      if (data.success) {
        showMessage(`Password reset! Welcome back, ${data.userName}!`);
        setNewPassword(''); setConfirmPassword('');
        setTimeout(() => navigate('/'), 2000);
      } else {
        showMessage(data.error || 'Failed to reset password', true);
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
        <div className={`message ${message.isError ? 'error' : 'success'}`}>{message.text}</div>
      )}

      <div className="forgot-card">
        <h1><i className="fa-solid fa-key" style={{ marginRight: 10, color: 'var(--nb-blue)' }}></i>Reset Password</h1>
        <div className="divider"></div>
        <p>Enter your new password below.</p>
        <form className="reset-form" onSubmit={handleSubmit}>
          <div style={{ position: 'relative' }}>
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              style={{ paddingRight: 44 }}
            />
            <i
              className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}
              onClick={() => setShowPassword(v => !v)}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: 15, color: 'var(--nb-black)' }}
            />
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Resetting...' : 'Reset Password →'}
          </button>
          <button type="button" onClick={() => navigate('/')} disabled={loading} style={{ background: 'var(--nb-white)', color: 'var(--nb-black)' }}>
            ← Back to Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
