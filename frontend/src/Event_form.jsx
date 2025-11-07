import React, { useState, useRef, useEffect } from 'react'; // <-- EDITED: Added useRef and useEffect
import { useNavigate } from 'react-router-dom';
import './event_form.css';

// Get the base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const EventForm = () => {
  const navigate = useNavigate();
  const formContainerRef = useRef(null); // <-- NEW: Create a ref for the form container

  // <-- NEW: Add this useEffect hook
  // This forces the form container to scroll to the top on load
  useEffect(() => {
    if (formContainerRef.current) {
      formContainerRef.current.scrollTop = 0;
    }
  }, []); // Empty array ensures this runs only once when component mounts

  const [formData, setFormData] = useState({
    eventName: '',
    eventDescription: '',
    eventDate: '',
    eventTime: '',
    eventLocation: '',
    maxParticipants: '',
    maxVolunteers: '',
    OrgCid: '',
    registrationFee: '',
    isTeamEvent: false,
    minTeamSize: '',
    maxTeamSize: ''
  });

  const [message, setMessage] = useState({ text: '', isError: false, show: false });

  const showMessage = (text, isError = false) => {
    setMessage({ text, isError, show: true });
    setTimeout(() => {
      setMessage({ text: '', isError: false, show: false });
    }, 5000);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const data = {
      eventName: formData.eventName,
      eventDescription: formData.eventDescription,
      eventDate: formData.eventDate,
      eventTime: formData.eventTime,
      eventLocation: formData.eventLocation,
      maxParticipants: parseInt(formData.maxParticipants) || null,
      maxVolunteers: parseInt(formData.maxVolunteers) || null,
      OrgCid: parseInt(formData.OrgCid) || null,
      registrationFee: parseFloat(formData.registrationFee) || 0,
      isTeamEvent: formData.isTeamEvent,
      minTeamSize: formData.isTeamEvent ? (parseInt(formData.minTeamSize) || null) : null,
      maxTeamSize: formData.isTeamEvent ? (parseInt(formData.maxTeamSize) || null) : null
    };

    // Validation
    if (!data.eventName || !data.eventDescription || !data.eventDate || !data.eventTime || !data.eventLocation || !data.OrgCid) {
      showMessage('Please fill in all required fields.', true);
      return;
    }

    if (data.OrgCid <= 0) {
      showMessage('Club ID must be a positive number.', true);
      return;
    }

    const eventDate = new Date(data.eventDate);
    const currentDate = new Date();
    if (eventDate <= currentDate) {
      showMessage('Event date must be in the future.', true);
      return;
    }

    if (data.isTeamEvent) {
      if (!data.minTeamSize || !data.maxTeamSize) {
        showMessage('Please specify minimum and maximum team size for team events.', true);
        return;
      }
      if (data.minTeamSize < 2) {
        showMessage('Minimum team size must be at least 2.', true);
        return;
      }
      if (data.maxTeamSize < data.minTeamSize) {
        showMessage('Maximum team size must be >= minimum team size.', true);
        return;
      }
    }

    try {
      // EDITED: Using API_BASE_URL
      const res = await fetch(`${API_BASE_URL}/api/events/create`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await res.json();

      if (res.ok) {
        showMessage('Event created successfully!');
        setFormData({
          eventName: '', eventDescription: '', eventDate: '', eventTime: '',
          eventLocation: '', maxParticipants: '', maxVolunteers: '', OrgCid: '',
          registrationFee: '', isTeamEvent: false, minTeamSize: '', maxTeamSize: ''
        });
        setTimeout(() => navigate('/organisers'), 2000);
      } else {
        if (res.status === 401) {
          showMessage('Please sign in to create an event.', true);
          setTimeout(() => navigate('/'), 2000);
        } else {
          showMessage(`Failed to create event: ${result.error}`, true);
        }
      }
    } catch (err) {
      showMessage(`Error: ${err.message}`, true);
    }
  };

  return (
    <div className="event-form-container">
      {message.show && (
        <div className={`event-form-message ${message.isError ? 'event-form-message-error' : 'event-form-message-success'}`}>
          {message.text}
        </div>
      )}
      
      <div className="event-form-wrap event-form-registration">
        <div className="event-form-card">

          {/* DESKTOP HEADER - UNTOUCHED */}
          <div className="event-form-card-side event-form-left event-form-desktop-header">
            <div className="event-form-logo-text" data-text="Hey Organisers">
              Hey Organisers
            </div>
          </div>

          {/* MOBILE NEON HEADER - HIDDEN ON DESKTOP */}
          <div className="event-form-card-side event-form-left event-form-mobile-header">
            <div className="event-form-left-header">
              <div className="event-form-glow-text">
                <span className="event-form-neon">Hey</span>
                <span className="event-form-neon event-form-neon-alt">Organisers</span>
              </div>
              <div className="event-form-underline"></div>
            </div>
          </div>

          {/* FORM */}
          {/* <-- EDITED: Added the ref here --> */}
          <div className="event-form-card-side event-form-right" ref={formContainerRef}>
            <h2 className="event-form-title">Organize an Event</h2>
            <form className="event-form-form" onSubmit={handleSubmit}>
              <input className="event-form-input" type="text" name="eventName" placeholder="Event Name" value={formData.eventName} onChange={handleChange} required />
              <textarea className="event-form-textarea" name="eventDescription" placeholder="Description" value={formData.eventDescription} onChange={handleChange} rows="3" required />
              <input className="event-form-input" type="date" name="eventDate" value={formData.eventDate} onChange={handleChange} required />
              <input className="event-form-input" type="time" name="eventTime" value={formData.eventTime} onChange={handleChange} required />
              <input className="event-form-input" type="text" name="eventLocation" placeholder="Location" value={formData.eventLocation} onChange={handleChange} required />

              <div className="event-form-checkbox-group">
                <label className="event-form-checkbox-label">
                  <input type="checkbox" name="isTeamEvent" checked={formData.isTeamEvent} onChange={handleChange} className="event-form-checkbox" />
                  <span className="event-form-checkbox-text">Team Event</span>
                </label>
              </div>

              <input
                className="event-form-input"
                type="number"
                name="maxParticipants"
                placeholder={formData.isTeamEvent ? "Max Teams" : "Max Participants"}
                value={formData.maxParticipants}
          _       onChange={handleChange}
                min="1"
              />

              {formData.isTeamEvent && (
              .   <>
                  <input className="event-form-input" type="number" name="minTeamSize" placeholder="Minimum Team Size" value={formData.minTeamSize} onChange={handleChange} min="2" required />
                  <input className="event-form-input" type="number" name="maxTeamSize" placeholder="Maximum Team Size" value={formData.maxTeamSize} onChange={handleChange} min="2" required />
                </>
              )}

              <input className="event-form-input" type="number" name="maxVolunteers" placeholder="Max Volunteers" value={formData.maxVolunteers} onChange={handleChange} min="1" />
              <input className="event-form-input" type="number" name="OrgCid" placeholder="Club ID" value={formData.OrgCid} onChange={handleChange} min="1" required />
              <input className="event-form-input" type="number" name="registrationFee" placeholder="Registration Fee" value={formData.registrationFee} onChange={handleChange} step="0.01" min="0" required />
              
              <button className="event-form-button" type="submit">Create Event</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventForm;
