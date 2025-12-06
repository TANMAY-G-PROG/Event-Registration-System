import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './style.css';

// API calls are now relative to use the proxy
// We no longer need the API_BASE_URL variable

export default function Login() {
  const navigate = useNavigate();
  const [isActive, setIsActive] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false, show: false });
  const [showPassword, setShowPassword] = useState({ signIn: false, signUp: false });
  const [signInData, setSignInData] = useState({
    usn: '',
    password: '',
  });
  const [signUpData, setSignUpData] = useState({
    name: '',
    usn: '',
    sem: '',
    mobno: '',
    email: '',
    password: '',
  });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (message.show) {
      const timer = setTimeout(() => {
        setMessage((prev) => ({ ...prev, show: false }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [message.show]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/me', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        showMessage(`Already logged in as ${data.userName}. Redirecting...`);
        setTimeout(() => {
          navigate('/events');
        }, 1500);
      }
    } catch (error) {
      console.log('User not authenticated');
    }
  };

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError, show: true });
  };

  const handleSignIn = async () => {
    const { usn, password } = signInData;
    if (!usn || !password) {
      showMessage('Please fill in all fields', true);
      return;
    }
    try {
      const response = await fetch('/api/signin', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ usn, password }),
      });
      const data = await response.json();
      if (data.success) {
        showMessage(`Welcome back, ${data.userName}!`);
        setTimeout(() => {
          navigate('/events');
        }, 1500);
      } else {
        showMessage(data.error, true);
      }
    } catch (error) {
      console.error('Sign in error:', error);
      showMessage('Network error. Please try again.', true);
    }
  };

  const handleSignUp = async () => {
    const { name, usn, sem, mobno, email, password } = signUpData;
    if (!name || !usn || !sem || !mobno || !email || !password) {
      showMessage('Please fill in all fields', true);
      return;
    }
    
    // REMOVED: Strict 1BM regex check to allow other college USNs
    
    if (!/\S+@\S+\.\S+/.test(email)) {
      showMessage('Please enter a valid email address', true);
      return;
    }
    if (!/^\d{10}$/.test(mobno)) {
      showMessage('Please enter a valid 10-digit mobile number', true);
      return;
    }
    const semNum = parseInt(sem);
    if (semNum < 1 || semNum > 8) {
      showMessage('Semester must be between 1 and 8', true);
      return;
    }
    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, usn, sem: semNum, mobno, email, password }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        showMessage(errorData.error || 'Failed to sign up. Please try again.', true);
        return;
      }
      const data = await response.json();
      if (data.success) {
        showMessage(`Account created successfully! Welcome, ${data.userName}!`);
        setSignUpData({
          name: '',
          usn: '',
          sem: '',
          mobno: '',
          email: '',
          password: '',
        });
        setTimeout(() => {
          navigate('/events');
        }, 2000);
      } else {
        showMessage(data.error, true);
      }
    } catch (error) {
      console.error('Signup network error:', error);
      showMessage('Network error during signup. Please check your connection and try again.', true);
    }
  };

  const handleSignInChange = (e) => {
    setSignInData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSignUpChange = (e) => {
    const { name, value } = e.target;
    setSignUpData((prev) => ({
      ...prev,
      // Still converting to uppercase, but no longer enforcing 1BM prefix
      [name]: name === 'usn' ? value.toUpperCase() : value,
    }));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (isActive) {
        handleSignUp();
      } else {
        handleSignIn();
      }
    }
  };

  const handleAboutUsClick = () => {
    navigate('/about-us');
  };

  const handleContactUsClick = () => {
    navigate('/about-us#connect-section');
  };

  const togglePasswordVisibility = (formType) => {
    setShowPassword((prev) => ({
      ...prev,
      [formType]: !prev[formType],
    }));
  };

  return (
    <div className="login-page">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"
      />
      
      {/* TOP NAV BUTTONS */}
      <div className="top-nav-buttons">
        <button className="button" onClick={handleAboutUsClick}>
          <div className="bubble-layer bubble-1"></div>
          <div className="bubble-layer bubble-2"></div>
          <div className="bubble-layer bubble-3"></div>
          <div className="bubble-layer bubble-4"></div>
          <div className="bubble-layer bubble-5"></div>
          <div className="bubble-layer bubble-6"></div>
          <div className="bubble-layer bubble-7"></div>
          <span>About Us</span>
        </button>
        <button className="button" onClick={handleContactUsClick}>
          <div className="bubble-layer bubble-1"></div>
          <div className="bubble-layer bubble-2"></div>
          <div className="bubble-layer bubble-3"></div>
          <div className="bubble-layer bubble-4"></div>
          <div className="bubble-layer bubble-5"></div>
          <div className="bubble-layer bubble-6"></div>
          <div className="bubble-layer bubble-7"></div>
          <span>Contact Us</span>
        </button>
      </div>

      {/* TOAST MESSAGE */}
      {message.show && (
        <div className={`message ${message.isError ? 'error' : 'success'}`}>
          {message.text}
        </div>
      )}

      {/* DESKTOP/TABLET VIEW - Original Design */}
      <div className={`container ${isActive ? 'active' : ''}`} id="container">
        <div className="form-container sign-up">
          <form onKeyPress={handleKeyPress}>
            <h1>Create Account</h1>
            <input
              type="text"
              name="name"
              placeholder="Name"
              value={signUpData.name}
              onChange={handleSignUpChange}
            />
            <input
              type="text"
              name="usn"
              placeholder="USN"
              value={signUpData.usn}
              onChange={handleSignUpChange}
            />
            <input
              type="number"
              name="sem"
              placeholder="Semester"
              value={signUpData.sem}
              onChange={handleSignUpChange}
            />
            <input
              type="tel"
              name="mobno"
              placeholder="Mobile Number"
              value={signUpData.mobno}
              onChange={handleSignUpChange}
            />
            <input
              type="email"
              name="email"
              placeholder="Email ID"
              value={signUpData.email}
              onChange={handleSignUpChange}
            />
            <div className="password-wrapper">
              <input
                type={showPassword.signUp ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                value={signUpData.password}
                onChange={handleSignUpChange}
              />
              <i
                className={`fa-solid ${showPassword.signUp ? 'fa-eye-slash' : 'fa-eye'} password-toggle-icon`}
                onClick={() => togglePasswordVisibility('signUp')}
              ></i>
            </div>
            <button type="button" onClick={handleSignUp}>
              Sign Up
            </button>
          </form>
        </div>
        <div className="form-container sign-in">
          <form onKeyPress={handleKeyPress}>
            <h1>Sign In</h1>
            <input
              type="text"
              name="usn"
              placeholder="USN"
              id="usn"
              value={signInData.usn}
              onChange={handleSignInChange}
            />
            <div className="password-wrapper">
              <input
                type={showPassword.signIn ? 'text' : 'password'}
                name="password"
                placeholder="Password"
                id="password"
                value={signInData.password}
                onChange={handleSignInChange}
              />
              <i
                className={`fa-solid ${showPassword.signIn ? 'fa-eye-slash' : 'fa-eye'} password-toggle-icon`}
                onClick={() => togglePasswordVisibility('signIn')}
              ></i>
            </div>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                navigate('/forgot-password');
              }}
              className="forgot-password-link"
            >
              Forgot Your Password?
            </a>
            <button type="button" onClick={handleSignIn}>
              Sign In
            </button>
          </form>
        </div>
        <div className="toggle-container">
          <div className="toggle">
            <div className="toggle-panel toggle-left">
              <h1>Welcome Back!</h1>
              <p>Enter your personal details to use all of site features</p>
              <button className="hidden" onClick={() => setIsActive(false)}>
                Sign In
              </button>
            </div>
            <div className="toggle-panel toggle-right">
              <h1>Hello, Friend!</h1>
              <p>Register with your personal details to create a new account</p>
              <button className="hidden" onClick={() => setIsActive(true)}>
                Sign Up
              </button>
            </div>
          </div>
        </div>
        <div className="mobile-toggle">
          <input
            type="radio"
            name="toggle"
            id="glass-signin"
            checked={!isActive}
            onChange={() => setIsActive(false)}
          />
          <label htmlFor="glass-signin">Sign In</label>
          <input
            type="radio"
            name="toggle"
            id="glass-signup"
            checked={isActive}
            onChange={() => setIsActive(true)}
          />
          <label htmlFor="glass-signup">Sign Up</label>
          <div className="glass-glider"></div>
        </div>
      </div>

      {/* MOBILE VIEW ONLY - New Design */}
      <div className="mobile-only-wrapper">
        {/* Hero Section */}
        <div className="hero-section">
          <div className="hero-content">
            <h1 className="hero-title">FLO.</h1>
            <div className="hero-divider"></div>
            <p className="hero-subtitle">The Pulse of Campus</p>
          </div>
        </div>

        {/* Interaction Sheet */}
        <div className="interaction-sheet">
          {/* Toggle Header */}
          <div className="sheet-header">
            <div>
              <h2 className="sheet-title">
                {isActive ? 'New Account' : 'Welcome Back'}
              </h2>
            </div>
            <button 
              onClick={() => setIsActive(!isActive)}
              className="toggle-button"
            >
              {isActive ? 'Log In Instead' : 'Create Account'}
            </button>
          </div>

          {/* Scrollable Form Area */}
          <div className="form-area">
            <form onSubmit={(e) => { e.preventDefault(); isActive ? handleSignUp() : handleSignIn(); }}>
              
              {!isActive ? (
                /* SIGN IN FORM */
                <div className="form-content">
                  <MobileInputField 
                    label="University Serial No." 
                    name="usn" 
                    value={signInData.usn} 
                    onChange={handleSignInChange} 
                    placeholder="USN" 
                  />
                  <MobileInputField 
                    label="Password" 
                    name="password" 
                    value={signInData.password} 
                    onChange={handleSignInChange} 
                    placeholder="Password" 
                    isPassword={true}
                    isVisible={showPassword.signIn}
                    onToggleVisibility={() => togglePasswordVisibility('signIn')}
                  />
                  <div className="forgot-password-container">
                    <a 
                      href="#" 
                      onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }} 
                      className="forgot-password-link-new"
                    >
                      Forgot Your Password?
                    </a>
                  </div>
                </div>
              ) : (
                /* SIGN UP FORM */
                <div className="form-content signup-form">
                  <MobileInputField 
                    label="Name" 
                    name="name" 
                    value={signUpData.name} 
                    onChange={handleSignUpChange} 
                    placeholder="Name" 
                  />
                  <MobileInputField 
                    label="USN" 
                    name="usn" 
                    value={signUpData.usn} 
                    onChange={handleSignUpChange} 
                    placeholder="USN" 
                  />
                  
                  <div className="form-row">
                    <MobileInputField 
                      label="Semester" 
                      name="sem" 
                      value={signUpData.sem} 
                      onChange={handleSignUpChange} 
                      placeholder="Semester" 
                      half={true} 
                      type="number" 
                    />
                    <MobileInputField 
                      label="Mobile Number" 
                      name="mobno" 
                      value={signUpData.mobno} 
                      onChange={handleSignUpChange} 
                      placeholder="Mobile Number" 
                      half={true} 
                      type="tel" 
                    />
                  </div>
                  
                  <MobileInputField 
                    label="Email ID" 
                    name="email" 
                    value={signUpData.email} 
                    onChange={handleSignUpChange} 
                    placeholder="Email ID" 
                    type="email" 
                  />
                  <MobileInputField 
                    label="Password" 
                    name="password" 
                    value={signUpData.password} 
                    onChange={handleSignUpChange} 
                    placeholder="Password"
                    isPassword={true}
                    isVisible={showPassword.signUp}
                    onToggleVisibility={() => togglePasswordVisibility('signUp')}
                  />
                </div>
              )}

              {/* ACTION BUTTON */}
              <button
                type="submit"
                className="submit-button"
              >
                {isActive ? 'SIGN UP' : 'SIGN IN'}
                <span className="button-arrow">→</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// Mobile Input Field Component
const MobileInputField = ({ label, name, value, onChange, placeholder, half, type = "text", isPassword, isVisible, onToggleVisibility }) => {
  const inputType = isPassword ? (isVisible ? 'text' : 'password') : type;

  return (
    <div className={`input-group ${half ? 'half-width' : 'full-width'}`}>
      <label className="input-label">
        {label}
      </label>
      <div className="input-wrapper">
        <input
          type={inputType}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="input-field"
        />
        {isPassword && (
          <button 
            type="button"
            onClick={onToggleVisibility}
            className="password-toggle-btn"
          >
            {isVisible ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
