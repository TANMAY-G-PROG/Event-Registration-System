import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './style.css';

// Use environment variable for API URL (from your new code)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false, show: false });

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError, show: true });
    setTimeout(() => {
      setMessage(prev => ({ ...prev, show: false }));
    }, 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!email) {
      showMessage('Please enter your email address', true);
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      showMessage('Please enter a valid email address', true);
      return;
    }

    setLoading(true);

    try {
      // Use the dynamic API_BASE_URL
      const response = await fetch(`${API_BASE_URL}/api/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Added from your new code for cookies
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      // More robust check from your new code
      if (response.ok && data.success) {
        showMessage(data.message || 'Password reset link sent! Check your email.');
        setEmail('');
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        showMessage(data.error || 'Failed to send reset link', true);
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      // Improved error message from your new code
      showMessage('Network error. Please check your connection and try again.', true);
    } finally {
      setLoading(false);
    }
  };

  // This JSX uses all your original CSS classes from './style.css'
  // It avoids the inline styles from your deployed code, which is better.
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

      <div className="container forgot-password-container">
        <div className="form-container forgot-password-form">
          <form onSubmit={handleSubmit}>
            <i className="fa-solid fa-lock forgot-password-icon"></i>
            <h1>Forgot Password?</h1>
            <p className="forgot-password-description">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email" // Added from your new code
            />
            
            <button 
              type="submit" 
              disabled={loading}
              className="submit-button"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            
            <button 
              type="button"
              onClick={() => navigate('/')}
              className="back-button"
              disabled={loading} // Added from your new code
            >
              Back to Sign In
            </button>
            
            <div className="info-tip">
              <strong>💡 Tip:</strong> Use the email address you registered with (e.g., yourname@bmsce.ac.in)
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
