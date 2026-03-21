import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { apiFetch } from './api.js';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      await apiFetch('/api/signout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      navigate('/login');
    }
  };

  const isHome = location.pathname === '/events';
  const isAuthPage = ['/', '/login', '/forgot-password', '/reset-password', '/auth/callback'].includes(location.pathname);

  if (isAuthPage) return null;

  return (
    <nav className="flo-nav">
      <div className="flo-nav-left">
        {!isHome && (
          <button className="flo-nav-btn flo-nav-back" onClick={() => navigate(-1)}>
            <i className="fas fa-arrow-left"></i>
            <span>Back</span>
          </button>
        )}
        <div className="flo-nav-brand">
          FLO<span>E-PASS</span>
        </div>
      </div>

      <div className="flo-nav-right">
        {location.pathname !== '/profile' && (
          <button className="flo-nav-btn flo-nav-profile" onClick={() => navigate('/profile')}>
            <i className="fas fa-user"></i>
            <span>Profile</span>
          </button>
        )}
        <button className="flo-nav-btn flo-nav-logout" onClick={handleLogout}>
          <i className="fas fa-sign-out-alt"></i>
          <span>Logout</span>
        </button>
      </div>
    </nav>
  );
}
