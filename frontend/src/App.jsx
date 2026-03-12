import React, { useEffect, useRef } from 'react';
import { 
  BrowserRouter as Router, 
  Routes, 
  Route, 
  Navigate,
  useNavigate,  // Added for programmatic navigation
  useLocation   // Added to check the current page
} from 'react-router-dom';

// --- Import your components (FIXED: Added .jsx extensions) ---
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

// --- NEW COMPONENT TO HOLD ROUTES AND INACTIVITY LOGIC ---
// This is necessary because hooks like useNavigate/useLocation 
// can only be used *inside* a <Router> component.
function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const timerId = useRef(null);
  // 10 minutes in milliseconds
  const timeoutDuration = 10 * 60 * 1000; 

  const handleLogout = async () => {
    // Clear the timer
    if (timerId.current) clearTimeout(timerId.current);
    
    // Only show alert and redirect if not already on the login/landing page
    const { pathname } = location;
    if (pathname !== '/login' && pathname !== '/') {
      // Call the signout API to destroy the server session
      try {
        await fetch('/api/signout', {
          method: 'POST',
          credentials: 'include'
        });
      } catch (error) {
        console.error("Error during auto-signout:", error);
      }

      // Show alert and redirect. 
      // NOTE: alert() blocks the UI. A custom modal would be a better user experience.
      alert("You have been logged out due to inactivity."); 
      navigate('/login');
    }
  };

  const resetTimer = () => {
    if (timerId.current) clearTimeout(timerId.current);
    timerId.current = setTimeout(handleLogout, timeoutDuration);
  };

  useEffect(() => {
    // List of events to track user activity
    const events = ['mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'];

    // Add event listeners
    const setupListeners = () => {
      events.forEach(event => window.addEventListener(event, resetTimer));
    };

    // Remove event listeners
    const cleanupListeners = () => {
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };

    // Only run the timer if we are NOT on the login or landing page
    const { pathname } = location;
    if (pathname !== '/login' && pathname !== '/') {
      setupListeners();
      resetTimer(); // Start the timer
    }

    // Cleanup function when component unmounts or location changes
    return () => {
      cleanupListeners();
      if (timerId.current) clearTimeout(timerId.current);
    };
  }, [location.pathname, navigate]); // Rerun this effect when the page (location) changes

  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />
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
      <Route path="/about-us" element={<AboutUs />} />
      <Route path="/qr" element={<QrCode />} />
      <Route path="/scanner" element={<Scanner />} />
      <Route path="/sub-events" element={<SubEventManager />} />
      
      {/* This catch-all route now correctly sends users to your LandingPage */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// --- MODIFIED App COMPONENT ---
// The main App component now wraps AppContent with the Router,
// which allows AppContent to use the necessary router hooks.
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
