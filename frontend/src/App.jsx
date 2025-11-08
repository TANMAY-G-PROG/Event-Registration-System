import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute'; // Add this import
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
        {/* Public routes */}
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} /> 
        <Route path="/reset-password" element={<ResetPassword />} />   
        <Route path="/about-us" element={<AboutUs/>} />
        
        {/* Protected routes */}
        <Route path="/events" element={<ProtectedRoute><Events /></ProtectedRoute>} />
        <Route path="/participants" element={<ProtectedRoute><Participants /></ProtectedRoute>} />
        <Route path="/organisers" element={<ProtectedRoute><Organisers /></ProtectedRoute>} />
        <Route path="/volunteers" element={<ProtectedRoute><Volunteers /></ProtectedRoute>} />
        <Route path="/create-event" element={<ProtectedRoute><EventForm /></ProtectedRoute>} />
        <Route path="/register-event" element={<ProtectedRoute><Registerevent /></ProtectedRoute>} />
        <Route path="/volunteer-event" element={<ProtectedRoute><VolunteerEvents/></ProtectedRoute>} />
        <Route path="/organiser-ticket" element={<ProtectedRoute><OrganizerTicket/></ProtectedRoute>} />
        <Route path="/participant-ticket" element={<ProtectedRoute><ParticipantTicket/></ProtectedRoute>} />
        <Route path="/volunteer-ticket" element={<ProtectedRoute><VolunteerTicket/></ProtectedRoute>} />
        <Route path="/qr" element={<ProtectedRoute><QrCode/></ProtectedRoute>} />
        <Route path="/scanner" element={<ProtectedRoute><Scanner/></ProtectedRoute>} />
        
        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
