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
      const response = await fetch('/api/reset-password', {
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

      <div className="reset-password-container">
        <div className="reset-password-form">
          <i className="fa-solid fa-key reset-icon"></i>
          <h1 className="reset-title">Reset Password</h1>
          <p className="reset-subtitle">
            Enter your new password below
          </p>
          
          <div className="password-input-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={loading}
              className="reset-input"
            />
            <i 
              className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} password-toggle`}
              onClick={() => setShowPassword(!showPassword)}
            ></i>
          </div>
          
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Confirm New Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            className="reset-input"
            onKeyPress={(e) => e.key === 'Enter' && handleSubmit(e)}
          />
          
          <button 
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="reset-button primary"
          >
            {loading ? 'Resetting...' : 'Reset Password'}
          </button>
          
          <button 
            type="button"
            onClick={() => navigate('/')}
            className="reset-button secondary"
          >
            Back to Sign In
          </button>
          
          <div className="password-requirements">
            <strong>⚠️ Password Requirements:</strong>
            <ul>
              <li>At least 6 characters long</li>
              <li>Both passwords must match</li>
            </ul>
          </div>
        </div>
      </div>

      <style>{`
        .reset-password-container {
          background: #fff;
          border-radius: 12px;
          box-shadow: 0 5px 15px rgba(0,0,0,0.3);
          width: 90%;
          max-width: 500px;
          margin: 0 auto;
          overflow: hidden;
        }

        .reset-password-form {
          padding: 40px 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .reset-icon {
          font-size: 48px;
          color: #1A2980;
          margin-bottom: 20px;
        }

        .reset-title {
          margin: 0 0 10px 0;
          font-size: 28px;
          color: #333;
          text-align: center;
        }

        .reset-subtitle {
          text-align: center;
          margin: 0 0 25px 0;
          color: #666;
          font-size: 14px;
        }

        .password-input-wrapper {
          position: relative;
          width: 100%;
          margin-bottom: 15px;
        }

        .reset-input {
          width: 100%;
          padding: 12px 45px 12px 15px;
          margin-bottom: 15px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
          transition: border-color 0.3s;
        }

        .password-input-wrapper .reset-input {
          margin-bottom: 0;
        }

        .reset-input:focus {
          outline: none;
          border-color: #1A2980;
        }

        .reset-input:disabled {
          background-color: #f5f5f5;
          cursor: not-allowed;
        }

        .password-toggle {
          position: absolute;
          right: 15px;
          top: 50%;
          transform: translateY(-50%);
          cursor: pointer;
          color: #666;
          font-size: 16px;
        }

        .reset-button {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s;
          margin-top: 10px;
        }

        .reset-button.primary {
          background: linear-gradient(to right, #1A2980, #26D0CE);
          color: white;
        }

        .reset-button.primary:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(26, 41, 128, 0.3);
        }

        .reset-button.primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .reset-button.secondary {
          background: transparent;
          color: #1A2980;
          border: 1px solid #1A2980;
        }

        .reset-button.secondary:hover {
          background: rgba(26, 41, 128, 0.05);
        }

        .password-requirements {
          margin-top: 20px;
          padding: 15px;
          background-color: #fff3cd;
          border-left: 4px solid #ffc107;
          border-radius: 5px;
          font-size: 12px;
          width: 100%;
          box-sizing: border-box;
        }

        .password-requirements strong {
          display: block;
          margin-bottom: 8px;
          color: #856404;
        }

        .password-requirements ul {
          margin: 0;
          padding-left: 20px;
          color: #856404;
        }

        .password-requirements li {
          margin: 3px 0;
        }

        /* Mobile responsiveness */
        @media (max-width: 600px) {
          .reset-password-container {
            width: 95%;
            margin: 10px auto;
          }

          .reset-password-form {
            padding: 30px 20px;
          }

          .reset-icon {
            font-size: 40px;
            margin-bottom: 15px;
          }

          .reset-title {
            font-size: 24px;
            margin-bottom: 8px;
          }

          .reset-subtitle {
            font-size: 13px;
            margin-bottom: 20px;
          }

          .reset-input {
            padding: 10px 40px 10px 12px;
            font-size: 13px;
          }

          .password-toggle {
            right: 12px;
            font-size: 14px;
          }

          .reset-button {
            padding: 11px;
            font-size: 13px;
          }

          .password-requirements {
            padding: 12px;
            font-size: 11px;
          }

          .password-requirements ul {
            padding-left: 18px;
          }
        }

        @media (max-width: 400px) {
          .reset-password-form {
            padding: 25px 15px;
          }

          .reset-title {
            font-size: 22px;
          }

          .reset-icon {
            font-size: 36px;
          }
        }
      `}</style>
    </div>
  );
}
