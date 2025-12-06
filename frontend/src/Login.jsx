import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './style.css';

export default function Login() {
  const navigate = useNavigate();

  // --- STATE ---
  const [isActive, setIsActive] = useState(false);
  const [message, setMessage] = useState({ text: '', isError: false, show: false });
  const [showPassword, setShowPassword] = useState({ signIn: false, signUp: false });
  
  // Data State
  const [signInData, setSignInData] = useState({ usn: '', password: '' });
  const [signUpData, setSignUpData] = useState({ 
    name: '', 
    usn: '', 
    sem: '', 
    mobno: '', 
    email: '', 
    password: '' 
  });

  // --- EFFECTS ---
  useEffect(() => { checkAuthStatus(); }, []);

  useEffect(() => {
    if (message.show) {
      const timer = setTimeout(() => setMessage(prev => ({ ...prev, show: false })), 5000);
      return () => clearTimeout(timer);
    }
  }, [message.show]);

  // --- API CALLS ---
  const checkAuthStatus = async () => {
    try {
      const response = await fetch('/api/me', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        showMessage(`Already logged in as ${data.userName}. Redirecting...`);
        setTimeout(() => navigate('/events'), 1500);
      }
    } catch (error) { console.log('User not authenticated'); }
  };

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError, show: true });
  };

  const handleSignIn = async (e) => {
    if(e) e.preventDefault();
    const { usn, password } = signInData;
    if (!usn || !password) return showMessage('Please fill in all fields', true);
    
    try {
      const response = await fetch('/api/signin', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usn, password }),
      });
      const data = await response.json();
      if (data.success) {
        showMessage(`Welcome back, ${data.userName}!`);
        setTimeout(() => navigate('/events'), 1500);
      } else { showMessage(data.error, true); }
    } catch (error) { showMessage('Network error. Please try again.', true); }
  };

  const handleSignUp = async (e) => {
    if(e) e.preventDefault();
    const { name, usn, sem, mobno, email, password } = signUpData;
    if (!name || !usn || !sem || !mobno || !email || !password) return showMessage('Please fill in all fields', true);
    if (!/\S+@\S+\.\S+/.test(email)) return showMessage('Please enter a valid email address', true);
    if (!/^\d{10}$/.test(mobno)) return showMessage('Please enter a valid 10-digit mobile number', true);
    
    const semNum = parseInt(sem);
    if (semNum < 1 || semNum > 8) return showMessage('Semester must be between 1 and 8', true);
    
    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, usn, sem: semNum, mobno, email, password }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        return showMessage(errorData.error || 'Failed to sign up.', true);
      }
      const data = await response.json();
      if (data.success) {
        showMessage(`Account created successfully! Welcome, ${data.userName}!`);
        setSignUpData({ name: '', usn: '', sem: '', mobno: '', email: '', password: '' });
        setTimeout(() => navigate('/events'), 2000);
      } else { showMessage(data.error, true); }
    } catch (error) { showMessage('Network error during signup.', true); }
  };

  // --- HANDLERS ---
  const handleSignInChange = (e) => setSignInData({ ...signInData, [e.target.name]: e.target.value });
  
  const handleSignUpChange = (e) => {
    const { name, value } = e.target;
    setSignUpData({ ...signUpData, [name]: name === 'usn' ? value.toUpperCase() : value });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      isActive ? handleSignUp() : handleSignIn();
    }
  };

  const togglePasswordVisibility = (formType) => {
    setShowPassword((prev) => ({ ...prev, [formType]: !prev[formType] }));
  };

  const handleAboutUsClick = () => navigate('/about-us');
  const handleContactUsClick = () => navigate('/about-us#connect-section');

  return (
    <div className="login-page">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />
      
      {/* 1. TOP NAVIGATION (Reverted to Old Style) */}
      <div className="top-nav-buttons">
        <button className="button" onClick={handleAboutUsClick}>
            {[1,2,3,4,5,6,7].map(i => <div key={i} className={`bubble-layer bubble-${i}`}></div>)}
            <span>About Us</span>
        </button>
        <button className="button" onClick={handleContactUsClick}>
            {[1,2,3,4,5,6,7].map(i => <div key={i} className={`bubble-layer bubble-${i}`}></div>)}
            <span>Contact Us</span>
        </button>
      </div>

      {/* 2. TOAST MESSAGE */}
      {message.show && (
        <div className={`message ${message.isError ? 'error' : 'success'}`}>
          {message.text}
        </div>
      )}

      {/* 3. DESKTOP VIEW (Original Sliding Design) */}
      <div className={`container desktop-view ${isActive ? 'active' : ''}`} id="container">
        <div className="form-container sign-up">
          <form onKeyPress={handleKeyPress}>
            <h1>Create Account</h1>
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
        <div className="form-container sign-in">
          <form onKeyPress={handleKeyPress}>
            <h1>Sign In</h1>
            <input type="text" name="usn" placeholder="USN" value={signInData.usn} onChange={handleSignInChange} />
            <div className="password-wrapper">
              <input type={showPassword.signIn ? 'text' : 'password'} name="password" placeholder="Password" value={signInData.password} onChange={handleSignInChange} />
              <i className={`fa-solid ${showPassword.signIn ? 'fa-eye-slash' : 'fa-eye'} password-toggle-icon`} onClick={() => togglePasswordVisibility('signIn')}></i>
            </div>
            <a href="#" onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }} className="forgot-password-link">Forgot Your Password?</a>
            <button type="button" onClick={handleSignIn}>Sign In</button>
          </form>
        </div>
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

      {/* 4. MOBILE VIEW (New Premium Design) */}
      <div className="mobile-view-wrapper">
        <div className="m-hero-section">
            <div className="m-hero-content">
                <h1 className="m-logo">FLO.</h1>
                <div className="m-divider"></div>
                <p className="m-tagline">The Pulse of Campus</p>
            </div>
        </div>

        <div className="m-interaction-sheet">
            <div className="m-sheet-header">
                <h2 className="m-sheet-title">{isActive ? 'New Account' : 'Welcome Back'}</h2>
                <button onClick={() => setIsActive(!isActive)} className="m-toggle-link">
                    {isActive ? 'Log In Instead' : 'Create Account'}
                </button>
            </div>

            <div className="m-form-scroll">
                <form onSubmit={isActive ? handleSignUp : handleSignIn}>
                    {!isActive ? (
                        <div className="m-form-group">
                            <MobileInput label="University Serial No." name="usn" value={signInData.usn} onChange={handleSignInChange} placeholder="USN" />
                            <MobileInput label="Password" name="password" value={signInData.password} onChange={handleSignInChange} placeholder="Password" isPassword={true} isVisible={showPassword.signIn} onToggleVisibility={() => togglePasswordVisibility('signIn')} />
                            <div className="m-forgot-wrapper">
                                <a href="#" onClick={(e) => { e.preventDefault(); navigate('/forgot-password'); }} className="m-forgot-link">Forgot Your Password?</a>
                            </div>
                        </div>
                    ) : (
                        <div className="m-form-group">
                            <MobileInput label="Name" name="name" value={signUpData.name} onChange={handleSignUpChange} placeholder="Name" />
                            <MobileInput label="USN" name="usn" value={signUpData.usn} onChange={handleSignUpChange} placeholder="USN" />
                            <div className="m-row">
                                <MobileInput label="Semester" name="sem" value={signUpData.sem} onChange={handleSignUpChange} placeholder="Sem" half={true} type="number" />
                                <MobileInput label="Mobile" name="mobno" value={signUpData.mobno} onChange={handleSignUpChange} placeholder="Mobile" half={true} type="tel" />
                            </div>
                            <MobileInput label="Email ID" name="email" value={signUpData.email} onChange={handleSignUpChange} placeholder="Email ID" type="email" />
                            <MobileInput label="Password" name="password" value={signUpData.password} onChange={handleSignUpChange} placeholder="Password" isPassword={true} isVisible={showPassword.signUp} onToggleVisibility={() => togglePasswordVisibility('signUp')} />
                        </div>
                    )}
                    <button type="submit" className="m-submit-btn">
                        {isActive ? 'SIGN UP' : 'SIGN IN'}
                        <span className="m-arrow">→</span>
                    </button>
                </form>
            </div>
        </div>
      </div>
    </div>
  );
}

const MobileInput = ({ label, name, value, onChange, placeholder, half, type = "text", isPassword, isVisible, onToggleVisibility }) => {
    const inputType = isPassword ? (isVisible ? 'text' : 'password') : type;
    return (
      <div className={`m-input-wrapper ${half ? 'm-half' : ''}`}>
        <label className="m-label">{label}</label>
        <div className="m-input-container">
            <input type={inputType} name={name} value={value} onChange={onChange} placeholder={placeholder} className="m-input-field" />
            {isPassword && (
                <button type="button" onClick={onToggleVisibility} className="m-pass-toggle">
                    {isVisible ? <i className="fa-solid fa-eye-slash"></i> : <i className="fa-solid fa-eye"></i>}
                </button>
            )}
        </div>
      </div>
    );
};
