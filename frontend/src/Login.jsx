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
      const response = await fetch('/api/me', { // ✅ CHANGED
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
      const response = await fetch('/api/signin', { // ✅ CHANGED
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
    if (!/^1BM\d{2}[A-Z]{2}\d{3}$/.test(usn)) {
      showMessage('Invalid USN format. Example: 1BM23CS101', true);
      return;
    }
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
      const response = await fetch('/api/signup', { // ✅ CHANGED
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
      {message.show && (
        <div className={`message ${message.isError ? 'error' : 'success'}`}>
          {message.text}
        </div>
      )}
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
    </div>
  );
}
