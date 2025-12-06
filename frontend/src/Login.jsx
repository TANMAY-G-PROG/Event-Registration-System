import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './style.css';

export default function Login() {
  const navigate = useNavigate();
  // isActive = false (Sign In), isActive = true (Sign Up)
  const [isActive, setIsActive] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false, show: false });
  const [showPassword, setShowPassword] = useState({ signIn: false, signUp: false });
  
  // Data States
  const [signInData, setSignInData] = useState({ usn: '', password: '' });
  const [signUpData, setSignUpData] = useState({ 
    name: '', usn: '', sem: '', mobno: '', email: '', password: '' 
  });

  // --- API & LOGIC (Untouched) ---
  useEffect(() => { checkAuthStatus(); }, []);
  useEffect(() => { 
    if (message.show) { 
      const timer = setTimeout(() => setMessage(prev => ({ ...prev, show: false })), 5000); 
      return () => clearTimeout(timer); 
    } 
  }, [message.show]);

  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/me', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        showMessage(`Logged in as ${data.userName}`);
        setTimeout(() => navigate('/events'), 1500);
      }
    } catch (error) {}
  };

  const showMessage = (text, isError = false) => setMessage({ text, isError, show: true });

  const handleSignIn = async () => {
    const { usn, password } = signInData;
    if (!usn || !password) return showMessage('Please fill in all fields', true);
    try {
      const response = await fetch('/api/signin', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usn, password }),
      });
      const data = await response.json();
      if (data.success) {
        showMessage(`Welcome back, ${data.userName}!`);
        setTimeout(() => navigate('/events'), 1500);
      } else { showMessage(data.error, true); }
    } catch (error) { showMessage('Network error. Please try again.', true); }
  };

  const handleSignUp = async () => {
    const { name, usn, sem, mobno, email, password } = signUpData;
    if (!name || !usn || !sem || !mobno || !email || !password) return showMessage('Please fill in all fields', true);
    if (!/\S+@\S+\.\S+/.test(email)) return showMessage('Please enter a valid email address', true);
    if (!/^\d{10}$/.test(mobno)) return showMessage('Please enter a valid 10-digit mobile number', true);
    const semNum = parseInt(sem);
    if (semNum < 1 || semNum > 8) return showMessage('Semester must be between 1 and 8', true);
    
    try {
      const response = await fetch('/api/signup', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, usn, sem: semNum, mobno, email, password }),
      });
      const data = await response.json();
      if (data.success) {
        showMessage(`Account created! Welcome, ${data.userName}!`);
        setSignUpData({ name: '', usn: '', sem: '', mobno: '', email: '', password: '' });
        setTimeout(() => navigate('/events'), 2000);
      } else { showMessage(data.error, true); }
    } catch (error) { showMessage('Network error during signup.', true); }
  };

  const handleSignInChange = (e) => setSignInData({ ...signInData, [e.target.name]: e.target.value });
  const handleSignUpChange = (e) => setSignUpData({ ...signUpData, [e.target.name]: e.target.name === 'usn' ? e.target.value.toUpperCase() : e.target.value });
  
  const handleKeyPress = (e) => { if (e.key === 'Enter') { e.preventDefault(); isActive ? handleSignUp() : handleSignIn(); } };
  const togglePasswordVisibility = (formType) => setShowPassword(prev => ({ ...prev, [formType]: !prev[formType] }));
  const handleAboutUsClick = () => navigate('/about-us');
  const handleContactUsClick = () => navigate('/about-us#connect-section');

  return (
    <div className="login-page">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
      
      {/* 1. TOP NAV BUTTONS (Fixed Top Right) */}
      <div className="top-nav-buttons">
        <button className="nav-bubble-btn" onClick={handleAboutUsClick}>
          <div className="bubble-layer bubble-1"></div>
          <div className="bubble-layer bubble-2"></div>
          <div className="bubble-layer bubble-3"></div>
          <div className="bubble-layer bubble-4"></div>
          <div className="bubble-layer bubble-5"></div>
          <div className="bubble-layer bubble-6"></div>
          <div className="bubble-layer bubble-7"></div>
          <span>About Us</span>
        </button>
        <button className="nav-bubble-btn" onClick={handleContactUsClick}>
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
        <div className={`message ${message.isError ? 'error' : 'success'}`}>{message.text}</div>
      )}

      {/* 2. HERO SECTION (Mobile Only) */}
      <div className="mobile-hero">
        <h1>FLO.</h1>
        <div className="line"></div>
        <p>The Pulse of Campus</p>
      </div>

      {/* 3. MAIN CONTAINER (Sheet on Mobile / Card on Desktop) */}
      <div className={`container ${isActive ? 'active' : ''}`} id="container">
        
        {/* MOBILE SHEET HEADER (Hidden on Desktop) */}
        <div className="mobile-sheet-header" style={{ display: window.innerWidth > 768 ? 'none' : 'flex' }}>
          <h2>{isActive ? 'New Account' : 'Welcome Back'}</h2>
          <button className="mobile-switch-btn" onClick={() => setIsActive(!isActive)}>
            {isActive ? 'Log In Instead' : 'Create Account'}
          </button>
        </div>

        {/* --- SIGN UP FORM --- */}
        <div className="form-container sign-up">
          <form onKeyPress={handleKeyPress}>
            <h1>Create Account</h1>
            {/* Removed H1 on mobile via CSS, Header used instead */}
            <input type="text" name="name" placeholder="Name" value={signUpData.name} onChange={handleSignUpChange} />
            <input type="text" name="usn" placeholder="USN" value={signUpData.usn} onChange={handleSignUpChange} />
            <input type="number" name="sem" placeholder="Semester" value={signUpData.sem} onChange={handleSignUpChange} />
            <input type="tel" name="mobno" placeholder="Mobile Number" value={signUpData.mobno} onChange={handleSignUpChange} />
            <input type="email" name="email" placeholder="Email ID" value={signUpData.email} onChange={handleSignUpChange} />
            
            <div className="password-wrapper">
              <input type={showPassword.signUp ? 'text' : 'password'} name="password" placeholder="Password" value={signUpData.password} onChange={handleSignUpChange} />
              <i className={`fa-solid ${showPassword.signUp ? 'fa-eye-slash' : 'fa-eye'} password-toggle-icon`} onClick={() => togglePasswordVisibility('signUp')}></i>
            </div>
            
            <button type="button" onClick={handleSignUp}>Sign Up</button>
          </form>
        </div>

        {/* --- SIGN IN FORM --- */}
        <div className="form-container sign-in">
          <form onKeyPress={handleKeyPress}>
            <h1>Sign In</h1>
            <input type="text" name="usn" placeholder="USN" id="usn" value={signInData.usn} onChange={handleSignInChange} />
            
            <div className="password-wrapper">
              <input type={showPassword.signIn ? 'text' : 'password'} name="password" placeholder="Password" id="password" value={signInData.password} onChange={handleSignInChange} />
              <i className={`fa-solid ${showPassword.signIn ? 'fa-eye-slash' : 'fa-eye'} password-toggle-icon`} onClick={() => togglePasswordVisibility('signIn')}></i>
            </div>
            
            <a href="#" onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }} className="forgot-password-link">Forgot Your Password?</a>
            <button type="button" onClick={handleSignIn}>Sign In</button>
          </form>
        </div>

        {/* --- DESKTOP TOGGLE OVERLAY (Hidden on Mobile via CSS) --- */}
        <div className="toggle-container">
          <div className="toggle">
            <div className="toggle-panel toggle-left">
              <h1>Welcome Back!</h1>
              <p>Enter your personal details to use all of site features</p>
              <button className="hidden" onClick={() => setIsActive(false)}>Sign In</button>
            </div>
            <div className="toggle-panel toggle-right">
              <h1>Hello, Friend!</h1>
              <p>Register with your personal details to create a new account</p>
              <button className="hidden" onClick={() => setIsActive(true)}>Sign Up</button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
