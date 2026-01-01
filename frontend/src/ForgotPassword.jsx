import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './style.css';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false, show: false });

  // Helper to show temporary messages
  const showMessage = (text, isError = false) => {
    setMessage({ text, isError, show: true });
    setTimeout(() => {
      setMessage(prev => ({ ...prev, show: false }));
    }, 5000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic validation
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
      // NOTE: If your frontend and backend are on different domains (e.g. on Render),
      // ensure you have a proxy set up or use the full backend URL here.
      // e.g., `${import.meta.env.VITE_API_URL}/api/forgot-password`
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', 
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Success: Show message and redirect
        showMessage(data.message || 'Link sent! Check your email (and Spam folder).');
        setEmail('');
        
        // Redirect to login after 3 seconds so they can read the message
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        // Error from backend
        showMessage(data.error || 'Failed to send reset link', true);
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      showMessage('Network error. Please check your connection and try again.', true);
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

      <div className="container forgot-password-container">
        <div className="form-container forgot-password-form">
          <form onSubmit={handleSubmit}>
            <i className="fa-solid fa-lock forgot-password-icon"></i>
            <h1>Forgot Password?</h1>
            
            <p className="forgot-password-description">
              Enter your email address and we'll send you a link to reset your password.
              <br />
              <span style={{ fontSize: '0.9em', opacity: 0.8, color: '#e67e22' }}>
                (Please check your Spam/Junk folder if not found)
              </span>
            </p>
            
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              autoComplete="email" 
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
              disabled={loading}
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
