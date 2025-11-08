import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

// Get the base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const ProtectedRoute = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(null); // null means "still checking"
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/me`, {
          method: 'GET',
          credentials: 'include', // Crucial: sends the session cookie
          headers: { 'Content-Type': 'application/json' }
        });
        if (response.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  // While checking, show a loading screen instead of redirecting
  if (isAuthenticated === null) {
    return (
      <div style={{ 
        height: '100vh', 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center',
        background: 'linear-gradient(to right, #e2e2e2, #c9d6ff)' 
      }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  // If authenticated, render the requested page (Outlet). 
  // If not, redirect to login, but remember where they were trying to go.
  return isAuthenticated ? <Outlet /> : <Navigate to="/" state={{ from: location }} replace />;
};

export default ProtectedRoute;
