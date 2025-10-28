import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './style.css';

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
      const response = await fetch('http://localhost:3000/api/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (data.success) {
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

      <div className="container" style={{ width: '500px', minHeight: '400px' }}>
        <div className="form-container" style={{ position: 'relative', width: '100%' }}>
          <form onSubmit={handleSubmit} style={{
            backgroundColor: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            padding: '40px',
            height: '100%'
          }}>
            <i className="fa-solid fa-lock" style={{ fontSize: '48px', color: '#1A2980', marginBottom: '20px' }}></i>
            <h1 style={{ marginBottom: '10px' }}>Forgot Password?</h1>
            <p style={{ textAlign: 'center', marginBottom: '20px', color: '#666' }}>
              Enter your email address and we'll send you a link to reset your password.
            </p>
            
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              style={{ width: '100%' }}
            />
            
            <button 
              type="submit" 
              disabled={loading}
              style={{ width: '100%', marginTop: '10px' }}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
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
              backgroundColor: '#f0f9ff', 
              borderLeft: '4px solid #1A2980',
              borderRadius: '5px',
              fontSize: '12px'
            }}>
              <strong>💡 Tip:</strong> Use the email address you registered with (e.g., yourname@bmsce.ac.in)
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}