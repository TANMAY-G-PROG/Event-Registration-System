import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import "./style.css";

// ─── ELEGANT SHAPE COMPONENT (From Kokonut UI) ────────────────
const ElegantShape = ({
  className,
  delay = 0,
  width = 400,
  height = 100,
  rotate = 0,
  gradient = "rgba(255,255,255,0.08)",
}) => {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -150,
        rotate: rotate - 15,
      }}
      animate={{
        opacity: 1,
        y: 0,
        rotate: rotate,
      }}
      transition={{
        duration: 2.4,
        delay,
        ease: [0.23, 0.86, 0.39, 0.96],
        opacity: { duration: 1.2 },
      }}
      className={`elegant-shape ${className}`}
      style={{ width, height }}
    >
      <motion.div
        animate={{
          y: [0, 15, 0],
        }}
        transition={{
          duration: 12,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
        }}
        className="shape-inner"
        style={{
          background: `linear-gradient(to right, transparent, ${gradient})`,
        }}
      />
    </motion.div>
  );
};

export default function Login() {
  const navigate = useNavigate();

  // ─── STATE ───────────────────────────────────────────────────
  const [isActive, setIsActive] = useState(false); // false = Sign In, true = Sign Up
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

  // ─── EFFECTS ─────────────────────────────────────────────────
  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (message.show) {
      const timer = setTimeout(() => setMessage((prev) => ({ ...prev, show: false })), 5000);
      return () => clearTimeout(timer);
    }
  }, [message.show]);

  // ─── API LOGIC ───────────────────────────────────────────────
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

  const togglePasswordVisibility = (form) => {
    setShowPassword((prev) => ({ ...prev, [form]: !prev[form] }));
  };

  // ─── RENDER ──────────────────────────────────────────────────
  return (
    <div className="login-page">
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css"
      />

      {/* 1. Background Gradients & Blurs */}
      <div className="bg-gradient-blur blur-indigo" />
      <div className="bg-gradient-blur blur-rose" />

      {/* 2. Floating Elegant Shapes (The Kokonut Effect) */}
      <div className="shapes-container">
        <ElegantShape
          delay={0.3}
          width={600}
          height={140}
          rotate={12}
          gradient="rgba(99, 102, 241, 0.15)" // Indigo
          className="shape-1"
        />
        <ElegantShape
          delay={0.5}
          width={500}
          height={120}
          rotate={-15}
          gradient="rgba(244, 63, 94, 0.15)" // Rose
          className="shape-2"
        />
        <ElegantShape
          delay={0.4}
          width={300}
          height={80}
          rotate={-8}
          gradient="rgba(139, 92, 246, 0.15)" // Violet
          className="shape-3"
        />
        <ElegantShape
          delay={0.6}
          width={200}
          height={60}
          rotate={20}
          gradient="rgba(245, 158, 11, 0.15)" // Amber
          className="shape-4"
        />
      </div>

      {/* 3. Main Glass Card */}
      <div className="content-wrapper">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.2, ease: [0.25, 0.4, 0.25, 1] }}
          className="glass-card"
        >
          {/* Internal Glow */}
          <div className="card-glow" />

          {/* Header Section */}
          <div className="card-header">
            <div className="logo-badge">
              <i className="fa-solid fa-bolt"></i>
            </div>
            <h1 className="title-gradient">
              {isActive ? "Join the Flow" : "Welcome Back"}
            </h1>
            <p className="subtitle">
              {isActive
                ? "Create your student profile to get started"
                : "Enter your credentials to access events"}
            </p>
          </div>

          {/* Toggle Switch */}
          <div className="auth-toggle">
            <button
              className={`toggle-btn ${!isActive ? "active" : ""}`}
              onClick={() => setIsActive(false)}
            >
              Sign In
            </button>
            <button
              className={`toggle-btn ${isActive ? "active" : ""}`}
              onClick={() => setIsActive(true)}
            >
              Sign Up
            </button>
          </div>

          {/* Form Section */}
          <form className="auth-form" onSubmit={isActive ? handleSignUp : handleSignIn}>
            
            {!isActive ? (
              // ─── SIGN IN FORM ───────────────────────
              <motion.div
                key="signin"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className="form-group-wrapper"
              >
                <div className="input-group">
                  <label>University Serial No.</label>
                  <input
                    type="text"
                    name="usn"
                    value={signInData.usn}
                    onChange={handleSignInChange}
                    placeholder="Enter USN"
                  />
                </div>
                <div className="input-group">
                  <label>Password</label>
                  <div className="password-wrapper">
                    <input
                      type={showPassword.signIn ? "text" : "password"}
                      name="password"
                      value={signInData.password}
                      onChange={handleSignInChange}
                      placeholder="••••••••"
                    />
                    <i
                      className={`fa-solid ${
                        showPassword.signIn ? "fa-eye-slash" : "fa-eye"
                      } toggle-icon`}
                      onClick={() => togglePasswordVisibility("signIn")}
                    />
                  </div>
                </div>
                <div className="form-footer">
                   <a href="#" onClick={(e) => { e.preventDefault(); navigate("/forgot-password"); }}>
                     Forgot Password?
                   </a>
                </div>
              </motion.div>
            ) : (
              // ─── SIGN UP FORM ───────────────────────
              <motion.div
                key="signup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className="form-group-wrapper scrollable-signup"
              >
                <div className="input-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    name="name"
                    value={signUpData.name}
                    onChange={handleSignUpChange}
                    placeholder="John Doe"
                  />
                </div>
                <div className="row">
                  <div className="input-group half">
                    <label>USN</label>
                    <input
                      type="text"
                      name="usn"
                      value={signUpData.usn}
                      onChange={handleSignUpChange}
                      placeholder="1BM..."
                    />
                  </div>
                  <div className="input-group half">
                    <label>Sem</label>
                    <input
                      type="number"
                      name="sem"
                      value={signUpData.sem}
                      onChange={handleSignUpChange}
                      placeholder="1-8"
                    />
                  </div>
                </div>
                <div className="input-group">
                  <label>Mobile</label>
                  <input
                    type="tel"
                    name="mobno"
                    value={signUpData.mobno}
                    onChange={handleSignUpChange}
                    placeholder="9999999999"
                  />
                </div>
                <div className="input-group">
                  <label>Email</label>
                  <input
                    type="email"
                    name="email"
                    value={signUpData.email}
                    onChange={handleSignUpChange}
                    placeholder="email@example.com"
                  />
                </div>
                <div className="input-group">
                  <label>Password</label>
                  <div className="password-wrapper">
                    <input
                      type={showPassword.signUp ? "text" : "password"}
                      name="password"
                      value={signUpData.password}
                      onChange={handleSignUpChange}
                      placeholder="••••••••"
                    />
                    <i
                      className={`fa-solid ${
                        showPassword.signUp ? "fa-eye-slash" : "fa-eye"
                      } toggle-icon`}
                      onClick={() => togglePasswordVisibility("signUp")}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.02, opacity: 0.9 }}
              whileTap={{ scale: 0.98 }}
              className="submit-btn"
              type="submit"
            >
              {isActive ? "Create Account" : "Sign In"}
            </motion.button>
          </form>
        </motion.div>
      </div>

      {/* Toast Message */}
      {message.show && (
        <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`toast-message ${message.isError ? "error" : "success"}`}
        >
          {message.text}
        </motion.div>
      )}

      {/* Overlay to darken edges */}
      <div className="overlay-gradient" />
    </div>
  );
}
