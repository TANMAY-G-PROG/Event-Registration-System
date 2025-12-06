import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './style.css'; // ← This is now SAFE

export default function Login() {
  const navigate = useNavigate();

  const [isActive, setIsActive] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false, show: false });
  const [showPassword, setShowPassword] = useState({ signIn: false, signUp: false });

  const [signInData, setSignInData] = useState({ usn: '', password: '' });
  const [signUpData, setSignUpData] = useState({
    name: '', usn: '', sem: '', mobno: '', email: '', password: ''
  });

  useEffect(() => { checkAuthStatus(); }, []);

  useEffect(() => {
    if (message.show) {
      const t = setTimeout(() => setMessage(p => ({ ...p, show: false })), 5000);
      return () => clearTimeout(t);
    }
  }, [message.show]);

  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/me', { method: 'GET', credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        showMessage(`Already logged in as ${data.userName}. Redirecting...`);
        setTimeout(() => navigate('/events'), 1500);
      }
    } catch (_) { }
  };

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError, show: true });
  };

  const handleSignIn = async (e) => {
    if (e) e.preventDefault();
    const { usn, password } = signInData;
    if (!usn || !password) return showMessage('Please fill in all fields', true);

    try {
      const res = await fetch('/api/signin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usn, password })
      });
      const data = await res.json();
      if (data.success) {
        showMessage(`Welcome back, ${data.userName}!`);
        setTimeout(() => navigate('/events'), 1500);
      } else showMessage(data.error || 'Sign in failed', true);
    } catch (_) {
      showMessage('Network error', true);
    }
  };

  const handleSignUp = async (e) => {
    if (e) e.preventDefault();
    const { name, usn, sem, mobno, email, password } = signUpData;
    if (!name || !usn || !sem || !mobno || !email || !password)
      return showMessage('Please fill in all fields', true);
    if (!/\S+@\S+\.\S+/.test(email)) return showMessage('Invalid email', true);
    if (!/^\d{10}$/.test(mobno)) return showMessage('Invalid mobile number', true);
    const semNum = +sem;
    if (semNum < 1 || semNum > 8) return showMessage('Semester 1–8 only', true);

    try {
      const res = await fetch('/api/signup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, usn, sem: semNum, mobno, email, password })
      });
      const data = await res.json();
      if (data.success) {
        showMessage(`Welcome, ${data.userName}!`);
        setSignUpData({ name: '', usn: '', sem: '', mobno: '', email: '', password: '' });
        setTimeout(() => navigate('/events'), 2000);
      } else showMessage(data.error || 'Signup failed', true);
    } catch (_) {
      showMessage('Network error', true);
    }
  };

  const handleSignInChange = (e) => setSignInData({ ...signInData, [e.target.name]: e.target.value });
  const handleSignUpChange = (e) => {
    const { name, value } = e.target;
    setSignUpData({ ...signUpData, [name]: name === 'usn' ? value.toUpperCase() : value });
  };

  const togglePasswordVisibility = (type) => {
    setShowPassword(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const handleAboutUsClick = () => navigate('/about-us');
  const handleContactUsClick = () => navigate('/about-us#connect-section');

  return (
    <div className="login-root"> {/* ← UNIQUE CLASS – NO LEAKAGE */}

      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />

      {/* Top Nav Buttons */}
      <div className="login-top-nav">
        <button className="bubble-btn" onClick={handleAboutUsClick}>
          {[1,2,3,4,5,6,7].map(i => <div key={i} className={`bubble-layer b${i}`}></div>)}
          <span>About Us</span>
        </button>
        <button className="bubble-btn" onClick={handleContactUsClick}>
          {[1,2,3,4,5,6,7].map(i => <div key={i} className={`bubble-layer b${i}`}></div>)}
          <span>Contact Us</span>
        </button>
      </div>

      {/* Toast */}
      {message.show && (
        <div className={`login-toast ${message.isError ? 'error' : 'success'}`}>
          {message.text}
        </div>
      )}

      {/* Desktop View */}
      <div className={`login-container desktop-view ${isActive ? 'active' : ''}`}>
        {/* ... same JSX as before ... */}
        {/* (keeping the exact same structure – only class names changed slightly where needed) */}

        <div className="form-container sign-up">
          <form onKeyPress={e => e.key === 'Enter' && handleSignUp()}>
            <h1>Create Account</h1>
            <input type="text" name="name" placeholder="Name" value={signUpData.name} onChange={handleSignUpChange} />
            <input type="text" name="usn" placeholder="USN" value={signUpData.usn} onChange={handleSignUpChange} />
            <input type="number" name="sem" placeholder="Semester" value={signUpData.sem} onChange={handleSignUpChange} />
            <input type="tel" name="mobno" placeholder="Mobile Number" value={signUpData.mobno} onChange={handleSignUpChange} />
            <input type="email" name="email" placeholder="Email ID" value={signUpData.email} onChange={handleSignUpChange} />
            <div className="password-wrapper">
              <input type={showPassword.signUp ? 'text' : 'password'} name="password" placeholder="Password"
                value={signUpData.password} onChange={handleSignUpChange} />
              <i className={`fa-solid ${showPassword.signUp ? 'fa-eye-slash' : 'fa-eye'} password-toggle-icon`}
                onClick={() => togglePasswordVisibility('signUp')}></i>
            </div>
            <button type="button" className="login-submit-btn" onClick={handleSignUp}>Sign Up</button>
          </form>
        </div>

        <div className="form-container sign-in">
          <form onKeyPress={e => e.key === 'Enter' && handleSignIn()}>
            <h1>Sign In</h1>
            <input type="text" name="usn" placeholder="USN" value={signInData.usn} onChange={handleSignInChange} />
            <div className="password-wrapper">
              <input type={showPassword.signIn ? 'text' : 'password'} name="password" placeholder="Password"
                value={signInData.password} onChange={handleSignInChange} />
              <i className={`fa-solid ${showPassword.signIn ? 'fa-eye-slash' : 'fa-eye'} password-toggle-icon`}
                onClick={() => togglePasswordVisibility('signIn')}></i>
            </div>
            <a href="#" onClick={e => { e.preventDefault(); navigate('/forgot-password'); }} className="forgot-link">
              Forgot Your Password?
            </a>
            <button type="button" className="login-submit-btn" onClick={handleSignIn}>Sign In</button>
          </form>
        </div>

        <div className="toggle-container">
          <div className="toggle">
            <div className="toggle-panel toggle-left">
              <h1>Welcome Back!</h1>
              <p>Enter your details to continue</p>
              <button className="hidden" onClick={() => setIsActive(false)}>Sign In</button>
            </div>
            <div className="toggle-panel toggle-right">
              <h1>Hello, Friend!</h1>
              <p>Register to join the pulse</p>
              <button className="hidden" onClick={() => setIsActive(true)}>Sign Up</button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile View – unchanged except wrapper class */}
      <div className="mobile-view-wrapper">
        {/* ... exact same mobile JSX ... */}
        {/* just make sure all buttons have class "m-submit-btn" or "bubble-btn" */}
      </div>

      {/* MobileInput component stays the same */}
      <MobileInput ... />
    </div>
  );
}

// MobileInput stays exactly the same
const MobileInput = ({ label, name, value, onChange, placeholder, half, type = "text", isPassword, isVisible, onToggleVisibility }) => { ... };
