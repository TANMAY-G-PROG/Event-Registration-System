import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// --- ADD THIS LINE ---
import LandingPage from './LandingPage'; // Import the new landing page

import Login from './Login';
import Events from './Events';
import Participants from './Participants';
import Organisers from './Organisers';
import Volunteers from './Volunteers';
import EventForm from './Event_form';
import Registerevent from './Registerevent';
import VolunteerEvents from './Volunteer_events';
import OrganizerTicket from './OrganizerTicket';
import VolunteerTicket from './VolunteerTicket';
import ParticipantTicket from './ParticipantTicket';
import AboutUs from './Aboutus';
import QrCode from './QrCode';
import Scanner from './Scanner';
import ForgotPassword from './ForgotPassword'; 
import ResetPassword from './ResetPassword';   

function App() {
  return (
    <Router>
      <Routes>
        {/* --- CHANGE THIS LINE --- */}
        <Route path="/" element={<LandingPage />} /> 

        {/* --- ADD THIS LINE --- */}
        <Route path="/login" element={<Login />} /> 

        {/* All other routes stay the same */}
        <Route path="/forgot-password" element={<ForgotPassword />} /> 
        <Route path="/reset-password" element={<ResetPassword />} />   
        <Route path="/events" element={<Events />} />
        <Route path="/participants" element={<Participants />} />
        <Route path="/organisers" element={<Organisers />} />
        <Route path="/volunteers" element={<Volunteers />} />
        <Route path="/create-event" element={<EventForm />} />
        <Route path="/register-event" element={<Registerevent />} />
        <Route path="/volunteer-event" element={<VolunteerEvents/>} />
        <Route path="/organiser-ticket" element={<OrganizerTicket/>} />
        <Route path="/participant-ticket" element={<ParticipantTicket/>} />
        <Route path="/volunteer-ticket" element={<VolunteerTicket/>} />
        <Route path="/about-us" element={<AboutUs/>} />
        <Route path="/qr" element={<QrCode/>} />
        <Route path="/scanner" element={<Scanner/>} />
        
        {/* This catch-all route now correctly sends users to your LandingPage */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
