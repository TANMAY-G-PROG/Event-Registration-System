import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { apiFetch } from './api.js';

const ProtectedRoute = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setIsAuthenticated(false);
        return;
      }
      try {
        const response = await apiFetch('/api/me', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        setIsAuthenticated(response.ok);
      } catch (error) {
        console.error('Auth check failed:', error);
        setIsAuthenticated(false);
      }
    };
    checkAuth();
  }, []);

  if (isAuthenticated === null) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'var(--nb-bg, #f5f0e8)',
        fontFamily: 'var(--nb-font-display, monospace)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 16 }}>
            FLO<span style={{
              display: 'inline-block', width: 8, height: 8,
              background: 'var(--nb-yellow, #FFE500)', border: '2px solid #0a0a0a',
              borderRadius: '50%', marginLeft: 4, verticalAlign: 'middle'
            }} />
          </div>
          <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.5 }}>
            Loading...
          </p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" state={{ from: location }} replace />;
};

export default ProtectedRoute;