import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./style.css";

import { apiFetch } from "./api.js";

export default function Login() {
  const navigate = useNavigate();

  const [isActive, setIsActive] = useState(false);
  const [message, setMessage] = useState({ text: "", isError: false, show: false });
  const [showPassword, setShowPassword] = useState({ signIn: false, signUp: false });
  const [loading, setLoading] = useState(false);

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
    const token = localStorage.getItem("token");
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
        localStorage.removeItem("token");
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
    setLoading(true);
    try {
      const res = await apiFetch("/api/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usn, password }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("token", data.token);
        showMessage(`Welcome back, ${data.userName || usn}!`);
        setTimeout(() => navigate("/events"), 1500);
      } else {
        showMessage(data.error || "Sign in failed", true);
      }
    } catch (err) {
      showMessage("Network error. Please try again.", true);
    } finally {
      setLoading(false);
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

    setLoading(true);
    try {
      const res = await apiFetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, usn, sem: semNum, mobno, email, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        localStorage.setItem("token", data.token);
        showMessage(`Account created! Welcome, ${data.userName || name}!`);
        setSignUpData({ name: "", usn: "", sem: "", mobno: "", email: "", password: "" });
        setTimeout(() => navigate("/events"), 2000);
      } else {
        showMessage(data.error || "Sign-up failed", true);
      }
    } catch (err) {
      showMessage("Network error during signup.", true);
    } finally {
      setLoading(false);
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
    <div className="flo-root">
      {/* FontAwesome for Mobile Eye Icons */}
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css" />

      {/* ── NAV ── */}
      <div className="flo-nav">
        <button className="flo-nav-btn" onClick={goTo("/about-us")}>About Us</button>
        <button className="flo-nav-btn" onClick={goToContact}>Contact Us</button>
      </div>

      {/* ── TOAST MESSAGE ── */}
      {message.show && (
        <div className={`flo-toast ${message.isError ? "flo-toast--error" : "flo-toast--success"}`}>
          <span className="flo-toast-icon">{message.isError ? "✕" : "✓"}</span>
          {message.text}
        </div>
      )}

      {/* ══════════════════════════════
          DESKTOP VIEW (Untouched)
      ══════════════════════════════ */}
      <div className="flo-desk desktop-view">
        <div className="flo-brand-panel">
          <div className="flo-brand-top">
            <div className="flo-logo">
              FLO<span className="flo-logo-dot" />
            </div>
            <div className="flo-logo-rule" />
            <p className="flo-brand-headline">
              {isActive ? "Welcome\nback." : "The Pulse\nof Campus."}
            </p>
            <p className="flo-brand-body">
              {isActive
                ? "Already part of the campus pulse? Head back to sign in."
                : "New to FLO? Join thousands of students discovering campus life."}
            </p>
            <button
              className="flo-brand-cta"
              onClick={() => setIsActive((a) => !a)}
            >
              <span>{isActive ? "← Sign In" : "Create Account"}</span>
              {!isActive && <span className="flo-brand-cta-arrow">→</span>}
            </button>
          </div>
          <div className="flo-brand-bottom">
            <p className="flo-brand-footer">© 2026 FLO — All rights reserved</p>
          </div>
          <div className="flo-brand-deco" aria-hidden="true" />
        </div>

        <div className="flo-form-panel">
          {/* SIGN IN */}
          <div className={`flo-form-wrap${isActive ? " flo-form-wrap--hidden" : ""}`}>
            <div className="flo-form-head">
              <span className="flo-form-eyebrow">Welcome back</span>
              <h1 className="flo-form-title">Sign In</h1>
            </div>
            <form className="flo-form" onKeyPress={handleKeyPress}>
              <div className="flo-field">
                <label className="flo-label">University Serial No.</label>
                <input
                  type="text"
                  name="usn"
                  className="flo-input"
                  placeholder="1AB22CS001"
                  value={signInData.usn}
                  onChange={handleSignInChange}
                  autoComplete="off"
                  spellCheck="false"
                />
              </div>
              <div className="flo-field">
                <label className="flo-label">Password</label>
                <div className="flo-pw-wrap">
                  <input
                    type={showPassword.signIn ? "text" : "password"}
                    name="password"
                    className="flo-input"
                    placeholder="Your password"
                    value={signInData.password}
                    onChange={handleSignInChange}
                  />
                  <button
                    type="button"
                    className="flo-pw-toggle"
                    onClick={() => togglePasswordVisibility("signIn")}
                  >
                    {showPassword.signIn ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="flo-forgot"
                onClick={() => navigate("/forgot-password")}
              >
                Forgot password?
              </button>
              <button
                type="button"
                className="flo-submit"
                onClick={handleSignIn}
                disabled={loading}
              >
                {loading ? <span className="flo-spinner" /> : <><span>Sign In</span><span className="flo-submit-arrow">→</span></>}
              </button>
            </form>
            <div className="flo-register-row">
              <p>Don't have an account?</p>
              <button className="flo-register-link" onClick={() => setIsActive(true)}>
                Register now
              </button>
            </div>
          </div>

          {/* SIGN UP */}
          <div className={`flo-form-wrap${!isActive ? " flo-form-wrap--hidden" : ""}`}>
            <div className="flo-form-head">
              <span className="flo-form-eyebrow">Join the campus</span>
              <h1 className="flo-form-title">New Account</h1>
            </div>
            <form className="flo-form flo-form--signup" onKeyPress={handleKeyPress}>
              <div className="flo-field">
                <label className="flo-label">Full Name</label>
                <input
                  type="text"
                  name="name"
                  className="flo-input"
                  placeholder="Rahul Sharma"
                  value={signUpData.name}
                  onChange={handleSignUpChange}
                />
              </div>
              <div className="flo-field">
                <label className="flo-label">USN</label>
                <input
                  type="text"
                  name="usn"
                  className="flo-input"
                  placeholder="1AB22CS001"
                  value={signUpData.usn}
                  onChange={handleSignUpChange}
                  autoComplete="off"
                />
              </div>
              <div className="flo-row">
                <div className="flo-field">
                  <label className="flo-label">Semester</label>
                  <input
                    type="number"
                    name="sem"
                    className="flo-input"
                    placeholder="1–8"
                    min="1"
                    max="8"
                    value={signUpData.sem}
                    onChange={handleSignUpChange}
                  />
                </div>
                <div className="flo-field">
                  <label className="flo-label">Mobile</label>
                  <input
                    type="tel"
                    name="mobno"
                    className="flo-input"
                    placeholder="9876543210"
                    value={signUpData.mobno}
                    onChange={handleSignUpChange}
                  />
                </div>
              </div>
              <div className="flo-field">
                <label className="flo-label">Email ID</label>
                <input
                  type="email"
                  name="email"
                  className="flo-input"
                  placeholder="you@college.edu"
                  value={signUpData.email}
                  onChange={handleSignUpChange}
                />
              </div>
              <div className="flo-field">
                <label className="flo-label">Password</label>
                <div className="flo-pw-wrap">
                  <input
                    type={showPassword.signUp ? "text" : "password"}
                    name="password"
                    className="flo-input"
                    placeholder="Create a strong password"
                    value={signUpData.password}
                    onChange={handleSignUpChange}
                  />
                  <button
                    type="button"
                    className="flo-pw-toggle"
                    onClick={() => togglePasswordVisibility("signUp")}
                  >
                    {showPassword.signUp ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="flo-submit"
                onClick={handleSignUp}
                disabled={loading}
              >
                {loading ? <span className="flo-spinner" /> : <><span>Create Account</span><span className="flo-submit-arrow">→</span></>}
              </button>
            </form>
            <div className="flo-register-row">
              <p>Already have an account?</p>
              <button className="flo-register-link" onClick={() => setIsActive(false)}>
                Sign in
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════
          NEW MODERN MOBILE VIEW
      ══════════════════════════════ */}
      <div className="mobile-view-wrapper">
        <div className="m-hero-section">
          <div className="m-hero-content">
            <h1 className="m-logo">FLO<span className="flo-logo-dot flo-logo-dot--sm" /></h1>
            <div className="m-divider" />
            <p className="m-tagline">The Pulse of Campus</p>
          </div>
        </div>

        <div className="m-interaction-sheet">
          <div className="m-sheet-header">
            <h2 className="m-sheet-title">{isActive ? "New Account" : "Welcome Back"}</h2>
            <button
              onClick={() => setIsActive(!isActive)}
              className="m-toggle-link"
            >
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
                      onClick={(e) => { e.preventDefault(); navigate("/forgot-password"); }}
                      className="m-forgot-link"
                    >
                      Forgot Your Password?
                    </a>
                  </div>
                </div>
              ) : (
                <div className="m-form-group">
                  <MobileInput label="Full Name" name="name" value={signUpData.name} onChange={handleSignUpChange} placeholder="Name" />
                  <MobileInput label="USN" name="usn" value={signUpData.usn} onChange={handleSignUpChange} placeholder="USN" />
                  <div className="m-row">
                    <MobileInput label="Semester" name="sem" value={signUpData.sem} onChange={handleSignUpChange} placeholder="Sem" half type="number" />
                    <MobileInput label="Mobile" name="mobno" value={signUpData.mobno} onChange={handleSignUpChange} placeholder="Mobile" half type="tel" />
                  </div>
                  <MobileInput label="Email ID" name="email" value={signUpData.email} onChange={handleSignUpChange} placeholder="Email ID" type="email" />
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

              <button type="submit" className="m-submit-btn" disabled={loading}>
                {loading ? <span className="flo-spinner" style={{borderColor: "rgba(242,235,217,.3)", borderTopColor: "var(--sand)"}}/> : (
                  <>{isActive ? "SIGN UP" : "SIGN IN"}<span className="m-arrow">→</span></>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Mobile Input Component (Updated for Modern UI) ── */
const MobileInput = ({
  label, name, value, onChange, placeholder,
  half, type = "text", isPassword, isVisible, onToggleVisibility,
}) => {
  const inputType = isPassword ? (isVisible ? "text" : "password") : type;
  return (
    <div className={`m-input-wrapper${half ? " m-half" : ""}`}>
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