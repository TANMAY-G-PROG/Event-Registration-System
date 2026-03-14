import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./style.css";

import { apiFetch } from "./api.js";

export default function Login() {
  const navigate = useNavigate();

  const [isActive, setIsActive] = useState(false);
  const [message, setMessage] = useState({ text: "", isError: false, show: false });
  const [showPassword, setShowPassword] = useState({ signIn: false, signUp: false });

  const [signInData, setSignInData] = useState({ usn: "", password: "" });
  const [signUpData, setSignUpData] = useState({
    name: "",
    usn: "",
    sem: "",
    mobno: "",
    email: "",
    password: "",
  });

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (message.show) {
      const timer = setTimeout(() => setMessage((prev) => ({ ...prev, show: false })), 5000);
      return () => clearTimeout(timer);
    }
  }, [message.show]);

  const checkAuthStatus = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const res = await apiFetch("/api/me", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        showMessage(`Already logged in as ${data.userName}. Redirecting...`);
        setTimeout(() => navigate("/events"), 1500);
      } else {
        // Token invalid/expired — clear it
        localStorage.removeItem('token');
      }
    } catch (err) {
      console.log("Not authenticated");
    }
  };

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError, show: true });
  };

  const handleSignIn = async (e) => {
    e?.preventDefault();
    const { usn, password } = signInData;
    if (!usn || !password) return showMessage("Please fill in all fields", true);

    try {
      const res = await apiFetch("/api/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usn, password }),
      });
      const data = await res.json();

      if (data.success) {
        // Save JWT token to localStorage
        localStorage.setItem('token', data.token);
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
      const res = await apiFetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, usn, sem: semNum, mobno, email, password }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        // Save JWT token to localStorage
        localStorage.setItem('token', data.token);
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

  return (
    <div className="login-page">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"
      />

      <div className="top-nav-buttons">
        <button className="button" onClick={goTo("/about-us")}>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className={`bubble-layer bubble-${i}`} />
          ))}
          <span>About Us</span>
        </button>
        <button className="button" onClick={goToContact}>
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className={`bubble-layer bubble-${i}`} />
          ))}
          <span>Contact Us</span>
        </button>
      </div>

      {message.show && (
        <div className={`message ${message.isError ? "error" : "success"}`}>
          {message.text}
        </div>
      )}

      {/* Desktop View */}
      <div className={`container desktop-view ${isActive ? "active" : ""}`} id="container">
        {/* Sign-up form */}
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
                type={showPassword.signUp ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={signUpData.password}
                onChange={handleSignUpChange}
              />
              <i
                className={`fa-solid ${
                  showPassword.signUp ? "fa-eye-slash" : "fa-eye"
                } password-toggle-icon`}
                onClick={() => togglePasswordVisibility("signUp")}
              />
            </div>
            <button type="button" onClick={handleSignUp}>
              Sign Up
            </button>
          </form>
        </div>

        {/* Sign-in form */}
        <div className="form-container sign-in">
          <form onKeyPress={handleKeyPress}>
            <h1>Sign In</h1>
            <input
              type="text"
              name="usn"
              placeholder="USN"
              value={signInData.usn}
              onChange={handleSignInChange}
            />
            <div className="password-wrapper">
              <input
                type={showPassword.signIn ? "text" : "password"}
                name="password"
                placeholder="Password"
                value={signInData.password}
                onChange={handleSignInChange}
              />
              <i
                className={`fa-solid ${
                  showPassword.signIn ? "fa-eye-slash" : "fa-eye"
                } password-toggle-icon`}
                onClick={() => togglePasswordVisibility("signIn")}
              />
            </div>
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                navigate("/forgot-password");
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

        {/* Toggle overlay */}
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
      </div>

      {/* Mobile View */}
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

// Mobile Input Component
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
