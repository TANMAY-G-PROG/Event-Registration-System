import React, { useEffect, useRef } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation
} from 'react-router-dom';
import { apiFetch } from './api.js';

import NavBar from './NavBar.jsx';

import LandingPage from './LandingPage.jsx';
import Login from './Login.jsx';
import Events from './Events.jsx';
import Participants from './Participants.jsx';
import Organisers from './Organisers.jsx';
import Volunteers from './Volunteers.jsx';
import EventForm from './Event_form.jsx';
import Registerevent from './Registerevent.jsx';
import VolunteerEvents from './Volunteer_events.jsx';
import OrganizerTicket from './OrganizerTicket.jsx';
import VolunteerTicket from './VolunteerTicket.jsx';
import ParticipantTicket from './ParticipantTicket.jsx';
import AboutUs from './Aboutus.jsx';
import QrCode from './QrCode.jsx';
import Scanner from './Scanner.jsx';
import ForgotPassword from './ForgotPassword.jsx';
import ResetPassword from './ResetPassword.jsx';
import SubEventManager from './SubEventManager.jsx';
import AuthCallback from './AuthCallback.jsx';
import Profile from './Profile.jsx';

// Routes excluded from inactivity logout
const EXCLUDED_FROM_TIMEOUT = ['/', '/login', '/auth/callback', '/forgot-password', '/reset-password', '/qr'];

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const timerId = useRef(null);
  const timeoutDuration = 10 * 60 * 1000;

  const handleLogout = async () => {
    if (timerId.current) clearTimeout(timerId.current);
    const { pathname } = location;
    if (!EXCLUDED_FROM_TIMEOUT.includes(pathname)) {
      try {
        await apiFetch('/api/signout', { method: 'POST' });
      } catch (error) {
        console.error('Error during auto-signout:', error);
      }
      localStorage.removeItem('token');
      alert('You have been logged out due to inactivity.');
      navigate('/login');
    }
  };

  const resetTimer = () => {
    if (timerId.current) clearTimeout(timerId.current);
    timerId.current = setTimeout(handleLogout, timeoutDuration);
  };

  useEffect(() => {
    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];
    const setupListeners = () => events.forEach(e => window.addEventListener(e, resetTimer));
    const cleanupListeners = () => events.forEach(e => window.removeEventListener(e, resetTimer));
    const { pathname } = location;

    if (!EXCLUDED_FROM_TIMEOUT.includes(pathname)) {
      setupListeners();
      resetTimer();
    }

    return () => {
      cleanupListeners();
      if (timerId.current) clearTimeout(timerId.current);
    };
  }, [location.pathname, navigate]);

  // Hide Navbar on authentication pages and QR page
  const hideNavbarRoutes = ['/', '/login', '/auth/callback', '/forgot-password', '/reset-password'];
  const shouldShowNavbar = !hideNavbarRoutes.includes(location.pathname);

  return (
    <>
      {shouldShowNavbar && <NavBar />}

      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/events" element={<Events />} />
        <Route path="/participants" element={<Participants />} />
        <Route path="/organisers" element={<Organisers />} />
        <Route path="/volunteers" element={<Volunteers />} />
        <Route path="/create-event" element={<EventForm />} />
        <Route path="/register-event" element={<Registerevent />} />
        <Route path="/volunteer-event" element={<VolunteerEvents />} />
        <Route path="/organiser-ticket" element={<OrganizerTicket />} />
        <Route path="/participant-ticket" element={<ParticipantTicket />} />
        <Route path="/volunteer-ticket" element={<VolunteerTicket />} />
        {/* <Route path="/about-us" element={<AboutUs />} /> */}
        <Route path="/qr" element={<QrCode />} />
        <Route path="/scanner" element={<Scanner />} />
        <Route path="/sub-events" element={<SubEventManager />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}
