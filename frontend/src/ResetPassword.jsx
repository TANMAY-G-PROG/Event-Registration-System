import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './style.css';

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
    if (!token) {
      showMessage('Invalid reset link', true);
      setTimeout(() => navigate('/'), 2000);
    }
  }, [token, navigate]);

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError, show: true });
    setTimeout(() => {
      setMessage(prev => ({ ...prev, show: false }));
    }, 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword) {
      showMessage('Please fill in all fields', true);
      return;
    }

    if (newPassword.length < 6) {
      showMessage('Password must be at least 6 characters long', true);
      return;
    }

    if (newPassword !== confirmPassword) {
      showMessage('Passwords do not match', true);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('http://localhost:3000/api/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword })
      });

      const data = await response.json();

      if (data.success) {
        showMessage(`Password reset successfully! Welcome back, ${data.userName}!`);
        setNewPassword('');
        setConfirmPassword('');
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          navigate('/');
        }, 2000);
      } else {
        showMessage(data.error || 'Failed to reset password', true);
      }
    } catch (error) {
      console.error('Reset password error:', error);
      showMessage('Network error. Please try again.', true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"
      />

      {message.show && (
        <div className={`message ${message.isError ? 'error' : 'success'}`}>
          {message.text}
        </div>
      )}

      <div className="container" style={{ width: '500px', minHeight: '450px' }}>
        <div className="form-container" style={{ position: 'relative', width: '100%' }}>
          <div style={{
            backgroundColor: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            padding: '40px',
            height: '100%'
          }}>
            <i className="fa-solid fa-key" style={{ fontSize: '48px', color: '#1A2980', marginBottom: '20px' }}></i>
            <h1 style={{ marginBottom: '10px' }}>Reset Password</h1>
            <p style={{ textAlign: 'center', marginBottom: '20px', color: '#666' }}>
              Enter your new password below
            </p>
            
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="New Password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                style={{ width: '100%', paddingRight: '45px' }}
              />
              <i 
                className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '15px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  cursor: 'pointer',
                  color: '#666'
                }}
              ></i>
            </div>
            
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Confirm New Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
              style={{ width: '100%' }}
              onKeyPress={(e) => e.key === 'Enter' && handleSubmit(e)}
            />
            
            <button 
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              style={{ width: '100%', marginTop: '10px' }}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            
            <button 
              type="button"
              onClick={() => navigate('/')}
              style={{
                background: 'transparent',
                color: '#1A2980',
                border: '1px solid #1A2980',
                marginTop: '10px',
                width: '100%'
              }}
            >
              Back to Sign In
            </button>
            
            <div style={{ 
              marginTop: '20px', 
              padding: '15px', 
              backgroundColor: '#fff3cd', 
              borderLeft: '4px solid #ffc107',
              borderRadius: '5px',
              fontSize: '12px',
              width: '100%'
            }}>
              <strong>⚠️ Password Requirements:</strong>
              <ul style={{ margin: '5px 0 0 20px', padding: 0 }}>
                <li>At least 6 characters long</li>
                <li>Both passwords must match</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}