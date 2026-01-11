import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./style.css";

export default function Login() {
  const navigate = useNavigate();

  // ── State (UNCHANGED) ─────────────────────────────────────
  const [isActive, setIsActive] = useState(false);
  const [message, setMessage] = useState({ text: "", isError: false, show: false });
  const [showPassword, setShowPassword] = useState({ signIn: false, signUp: false });

  // Form data (UNCHANGED)
  const [signInData, setSignInData] = useState({ usn: "", password: "" });
  const [signUpData, setSignUpData] = useState({
    name: "",
    usn: "",
    sem: "",
    mobno: "",
    email: "",
    password: "",
  });

  // ── Effects (UNCHANGED) ───────────────────────────────────
  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (message.show) {
      const timer = setTimeout(() => setMessage((prev) => ({ ...prev, show: false })), 5000);
      return () => clearTimeout(timer);
    }
  }, [message.show]);

  // ── API Helpers (UNCHANGED) ───────────────────────────────
  const checkAuthStatus = async () => {
    try {
      const res = await fetch("/api/me", {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        showMessage(`Already logged in as ${data.userName}. Redirecting...`);
        setTimeout(() => navigate("/events"), 1500);
      }
    } catch (err) {
      console.log("Not authenticated");
    }
  };

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError, show: true });
  };

  // ── Handlers (UNCHANGED) ───────────────────────────────────
  const handleSignIn = async (e) => {
    e?.preventDefault();
    const { usn, password } = signInData;
    if (!usn || !password) return showMessage("Please fill in all fields", true);

    try {
      const res = await fetch("/api/signin", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usn, password }),
      });
      const data = await res.json();

      if (data.success) {
        showMessage(`Welcome back, ${data.userName || usn}!`);
        setTimeout(() => navigate("/events"), 1500);
      } else {
        showMessage(data.error || "Sign in failed", true);
      }
    } catch (err) {
      showMessage("Network error. Please try again.", true);
    }
  };

  const handleSignUp = async (e) => {
    e?.preventDefault();
    const { name, usn, sem, mobno, email, password } = signUpData;

    if (!name || !usn || !sem || !mobno || !email || !password)
      return showMessage("Please fill in all fields", true);
    if (!/\S+@\S+\.\S+/.test(email)) return showMessage("Invalid email address", true);
    if (!/^\d{10}$/.test(mobno)) return showMessage("Mobile number must be 10 digits", true);

    const semNum = parseInt(sem, 10);
    if (semNum < 1 || semNum > 8) return showMessage("Semester must be 1-8", true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, usn, sem: semNum, mobno, email, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        showMessage(`Account created! Welcome, ${data.userName || name}!`);
        setSignUpData({ name: "", usn: "", sem: "", mobno: "", email: "", password: "" });
        setTimeout(() => navigate("/events"), 2000);
      } else {
        showMessage(data.error || "Sign-up failed", true);
      }
    } catch (err) {
      showMessage("Network error during signup.", true);
    }
  };

  const handleSignInChange = (e) =>
    setSignInData({ ...signInData, [e.target.name]: e.target.value });

  const handleSignUpChange = (e) => {
    const { name, value } = e.target;
    setSignUpData((prev) => ({
      ...prev,
      [name]: name === "usn" ? value.toUpperCase() : value,
    }));
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      isActive ? handleSignUp() : handleSignIn();
    }
  };

  const togglePasswordVisibility = (form) => {
    setShowPassword((prev) => ({ ...prev, [form]: !prev[form] }));
  };

  const goTo = (path) => () => navigate(path);
  const goToContact = () => navigate("/about-us#connect-section");

  // ── Render ─────────────────────────────────────
  return (
    <div className="login-page">
      {/* Font Awesome */}
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"
      />

      {/* Cinematic Background Elements (New for Redesign) */}
      <div className="auth-background-wrapper">
         <div className="ambient-orb orb-1"></div>
         <div className="ambient-orb orb-2"></div>
         <div className="grid-overlay"></div>
      </div>

      {/* Top navigation buttons */}
      <div className="top-nav-buttons">
        <button className="button" onClick={goTo("/about-us")}>
          <span>About Us</span>
        </button>
        <button className="button" onClick={goToContact}>
          <span>Contact Us</span>
        </button>
      </div>

      {/* Toast message */}
      {message.show && (
        <div className={`message ${message.isError ? "error" : "success"}`}>
            <div className={`status-dot ${message.isError ? "red" : "green"}`}></div>
            {message.text}
        </div>
      )}

      {/* ── Desktop View (Redesigned) ───────────────────── */}
      <div className={`container desktop-view ${isActive ? "active" : ""}`} id="container">
        
        {/* Sign-up form */}
        <div className="form-container sign-up">
          <form onKeyPress={handleKeyPress}>
            <div className="form-header">
                <h1>Join the Flow</h1>
                <p className="subtitle">Create your student profile</p>
            </div>
            
            <div className="input-group">
                <input
                type="text"
                name="name"
                placeholder=" " 
                required
                value={signUpData.name}
                onChange={handleSignUpChange}
                />
                <label>Full Name</label>
            </div>

            <div className="row-inputs">
                <div className="input-group">
                    <input
                    type="text"
                    name="usn"
                    placeholder=" "
                    required
                    value={signUpData.usn}
                    onChange={handleSignUpChange}
                    />
                    <label>USN</label>
                </div>
                <div className="input-group">
                    <input
                    type="number"
                    name="sem"
                    placeholder=" "
                    required
                    value={signUpData.sem}
                    onChange={handleSignUpChange}
                    />
                    <label>Sem</label>
                </div>
            </div>

            <div className="row-inputs">
                 <div className="input-group">
                    <input
                    type="tel"
                    name="mobno"
                    placeholder=" "
                    required
                    value={signUpData.mobno}
                    onChange={handleSignUpChange}
                    />
                    <label>Mobile</label>
                </div>
                 <div className="input-group">
                    <input
                    type="email"
                    name="email"
                    placeholder=" "
                    required
                    value={signUpData.email}
                    onChange={handleSignUpChange}
                    />
                    <label>Email</label>
                </div>
            </div>

            <div className="input-group password-group">
              <input
                type={showPassword.signUp ? "text" : "password"}
                name="password"
                placeholder=" "
                required
                value={signUpData.password}
                onChange={handleSignUpChange}
              />
              <label>Password</label>
              <i
                className={`fa-solid ${
                  showPassword.signUp ? "fa-eye-slash" : "fa-eye"
                } password-toggle-icon`}
                onClick={() => togglePasswordVisibility("signUp")}
              />
            </div>

            <button type="button" className="action-btn" onClick={handleSignUp}>
              Create Account <i className="fa-solid fa-arrow-right"></i>
            </button>
          </form>
        </div>

        {/* Sign-in form */}
        <div className="form-container sign-in">
          <form onKeyPress={handleKeyPress}>
            <div className="form-header">
                <h1>Welcome Back</h1>
                <p className="subtitle">Enter your credentials to access events</p>
            </div>
            
            <div className="input-group">
              <input
                type="text"
                name="usn"
                placeholder=" "
                required
                value={signInData.usn}
                onChange={handleSignInChange}
              />
              <label>University Serial No.</label>
            </div>
            
            <div className="input-group password-group">
              <input
                type={showPassword.signIn ? "text" : "password"}
                name="password"
                placeholder=" "
                required
                value={signInData.password}
                onChange={handleSignInChange}
              />
              <label>Password</label>
              <i
                className={`fa-solid ${
                  showPassword.signIn ? "fa-eye-slash" : "fa-eye"
                } password-toggle-icon`}
                onClick={() => togglePasswordVisibility("signIn")}
              />
            </div>

            <div className="form-utilities">
                <a
                href="#"
                onClick={(e) => {
                    e.preventDefault();
                    navigate("/forgot-password");
                }}
                className="forgot-password-link"
                >
                Forgot Password?
                </a>
            </div>

            <button type="button" className="action-btn" onClick={handleSignIn}>
              Sign In <i className="fa-solid fa-arrow-right"></i>
            </button>
          </form>
        </div>

        {/* Toggle overlay */}
        <div className="toggle-container">
          <div className="toggle">
            <div className="toggle-panel toggle-left">
              <h1>Already<br/>aboard?</h1>
              <p>Sign in to access your event dashboard and certificates.</p>
              <button className="ghost-btn" onClick={() => setIsActive(false)}>
                Sign In
              </button>
            </div>
            <div className="toggle-panel toggle-right">
              <h1>New<br/>Here?</h1>
              <p>Join the community to register for events and competitions.</p>
              <button className="ghost-btn" onClick={() => setIsActive(true)}>
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile View (UNCHANGED) ───────────────────── */}
      <div className="mobile-view-wrapper">
        <div className="m-hero-section">
          <div className="m-hero-content">
            <h1 className="m-logo">FLO.</h1>
            <div className="m-divider" />
            <p className="m-tagline">The Pulse of Campus</p>
          </div>
        </div>

        <div className="m-interaction-sheet">
          <div className="m-sheet-header">
            <h2 className="m-sheet-title">{isActive ? "New Account" : "Welcome Back"}</h2>
            <button onClick={() => setIsActive(!isActive)} className="m-toggle-link">
              {isActive ? "Log In Instead" : "Create Account"}
            </button>
          </div>

          <div className="m-form-scroll">
            <form onSubmit={isActive ? handleSignUp : handleSignIn}>
              {!isActive ? (
                // Sign-in fields
                <div className="m-form-group">
                  <MobileInput
                    label="University Serial No."
                    name="usn"
                    value={signInData.usn}
                    onChange={handleSignInChange}
                    placeholder="USN"
                  />
                  <MobileInput
                    label="Password"
                    name="password"
                    value={signInData.password}
                    onChange={handleSignInChange}
                    placeholder="Password"
                    isPassword
                    isVisible={showPassword.signIn}
                    onToggleVisibility={() => togglePasswordVisibility("signIn")}
                  />
                  <div className="m-forgot-wrapper">
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        navigate("/forgot-password");
                      }}
                      className="m-forgot-link"
                    >
                      Forgot Your Password?
                    </a>
                  </div>
                </div>
              ) : (
                // Sign-up fields
                <div className="m-form-group">
                  <MobileInput
                    label="Name"
                    name="name"
                    value={signUpData.name}
                    onChange={handleSignUpChange}
                    placeholder="Name"
                  />
                  <MobileInput
                    label="USN"
                    name="usn"
                    value={signUpData.usn}
                    onChange={handleSignUpChange}
                    placeholder="USN"
                  />
                  <div className="m-row">
                    <MobileInput
                      label="Semester"
                      name="sem"
                      value={signUpData.sem}
                      onChange={handleSignUpChange}
                      placeholder="Sem"
                      half
                      type="number"
                    />
                    <MobileInput
                      label="Mobile"
                      name="mobno"
                      value={signUpData.mobno}
                      onChange={handleSignUpChange}
                      placeholder="Mobile"
                      half
                      type="tel"
                    />
                  </div>
                  <MobileInput
                    label="Email ID"
                    name="email"
                    value={signUpData.email}
                    onChange={handleSignUpChange}
                    placeholder="Email ID"
                    type="email"
                  />
                  <MobileInput
                    label="Password"
                    name="password"
                    value={signUpData.password}
                    onChange={handleSignUpChange}
                    placeholder="Password"
                    isPassword
                    isVisible={showPassword.signUp}
                    onToggleVisibility={() => togglePasswordVisibility("signUp")}
                  />
                </div>
              )}

              <button type="submit" className="m-submit-btn">
                {isActive ? "SIGN UP" : "SIGN IN"}
                <span className="m-arrow">→</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mobile Input Component (UNCHANGED) ─────────────────────
const MobileInput = ({
  label,
  name,
  value,
  onChange,
  placeholder,
  half,
  type = "text",
  isPassword,
  isVisible,
  onToggleVisibility,
}) => {
  const inputType = isPassword ? (isVisible ? "text" : "password") : type;

  return (
    <div className={`m-input-wrapper ${half ? "m-half" : ""}`}>
      <label className="m-label">{label}</label>
      <div className="m-input-container">
        <input
          type={inputType}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="m-input-field"
        />
        {isPassword && (
          <button type="button" onClick={onToggleVisibility} className="m-pass-toggle">
            {isVisible ? (
              <i className="fa-solid fa-eye-slash" />
            ) : (
              <i className="fa-solid fa-eye" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};
