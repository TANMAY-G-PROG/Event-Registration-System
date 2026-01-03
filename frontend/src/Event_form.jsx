import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './event_form.css';

const EventForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    eventName: '',
    eventDescription: '',
    certificateInfo: '',
    posterUrl: '', // NEW FIELD
    eventDate: '',
    eventTime: '',
    eventLocation: '',
    maxParticipants: '',
    maxVolunteers: '',
    OrgCid: '',
    registrationFee: '',
    upiId: '', 
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

    const regFee = parseFloat(formData.registrationFee) || 0;

    const data = {
      eventName: formData.eventName,
      eventDescription: formData.eventDescription,
      certificate_info: formData.certificateInfo || null,
      posterUrl: formData.posterUrl || null, // SEND TO BACKEND
      eventDate: formData.eventDate,
      eventTime: formData.eventTime,
      eventLocation: formData.eventLocation,
      maxParticipants: parseInt(formData.maxParticipants) || null,
      maxVolunteers: parseInt(formData.maxVolunteers) || null,
      OrgCid: parseInt(formData.OrgCid) || null,
      registrationFee: regFee,
      upiId: regFee > 0 ? formData.upiId : null, 
      isTeamEvent: formData.isTeamEvent,
      minTeamSize: formData.isTeamEvent ? (parseInt(formData.minTeamSize) || null) : null,
      maxTeamSize: formData.isTeamEvent ? (parseInt(formData.maxTeamSize) || null) : null
    };

    // Validation
    if (!data.eventName || !data.eventDescription || !data.eventDate || !data.eventTime || !data.eventLocation || !data.OrgCid) {
      showMessage('Please fill in all required fields.', true);
      return;
    }

    if (data.registrationFee > 0 && !data.upiId) {
      showMessage('Please enter a valid UPI ID for paid events.', true);
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
      const res = await fetch('/api/events/create', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await res.json();

      if (res.ok) {
        showMessage('Event created successfully!');
        setFormData({
          eventName: '', eventDescription: '', certificateInfo: '', posterUrl: '',
          eventDate: '', eventTime: '', eventLocation: '', maxParticipants: '', 
          maxVolunteers: '', OrgCid: '', registrationFee: '', upiId: '', 
          isTeamEvent: false, minTeamSize: '', maxTeamSize: ''
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

          {/* DESKTOP HEADER */}
          <div className="event-form-card-side event-form-left event-form-desktop-header">
            <div className="event-form-logo-text" data-text="Hey Organisers">
              Hey Organisers
            </div>
          </div>

          {/* MOBILE HEADER */}
          <div className="event-form-card-side event-form-left event-form-mobile-header">
            <div className="event-form-left-header">
              <div className="event-form-glow-text">
                <span className="event-form-neon">Hey</span>
                <span className="event-form-neon event-form-neon-alt">Organisers</span>
              </div>
            </div>
          </div>

          {/* FORM */}
          <div className="event-form-card-side event-form-right">
            <h2 className="event-form-title">Create Event</h2>
            <form className="event-form-form" onSubmit={handleSubmit}>
              <input 
                className="event-form-input" 
                type="text" 
                name="eventName" 
                placeholder="Event Name" 
                value={formData.eventName} 
                onChange={handleChange} 
                required 
              />
              
              <textarea 
                className="event-form-textarea" 
                name="eventDescription" 
                placeholder="What's this event about?" 
                value={formData.eventDescription} 
                onChange={handleChange} 
                rows="3" 
                required 
              />

              {/* NEW POSTER LINK INPUT */}
              <div style={{marginBottom: '22px'}}>
                <input 
                  className="event-form-input" 
                  type="url" 
                  name="posterUrl" 
                  placeholder="Poster_URL(Optional)" 
                  value={formData.posterUrl} 
                  onChange={handleChange} 
                  style={{marginBottom: '5px'}}
                />
                <small style={{fontSize: '11px', color: '#666', display: 'block', lineHeight: '1.2'}}>
                  Upload to Drive &gt; Right Click &gt; Share &gt; Copy Link (Anyone with link)
                </small>
              </div>

              <textarea 
                className="event-form-textarea" 
                name="certificateInfo" 
                placeholder="Certificate Text (Optional)" 
                value={formData.certificateInfo} 
                onChange={handleChange} 
                rows="2" 
              />
              
              <input 
                className="event-form-input" 
                type="date" 
                name="eventDate" 
                placeholder="Select Date"
                value={formData.eventDate} 
                onChange={handleChange} 
                required 
              />
              <input 
                className="event-form-input" 
                type="time" 
                name="eventTime" 
                placeholder="Select Time"
                value={formData.eventTime} 
                onChange={handleChange} 
                required 
              />
              
              <input 
                className="event-form-input" 
                type="text" 
                name="eventLocation" 
                placeholder="Location" 
                value={formData.eventLocation} 
                onChange={handleChange} 
                required 
              />

              <div className="event-form-checkbox-group">
                <label className="event-form-checkbox-label">
                  <span className="event-form-checkbox-text">This is a Team Event</span>
                  <input type="checkbox" name="isTeamEvent" checked={formData.isTeamEvent} onChange={handleChange} className="event-form-checkbox" />
                </label>
              </div>

              <input
                className="event-form-input"
                type="number"
                inputMode="numeric"
                name="maxParticipants"
                placeholder={formData.isTeamEvent ? "Max Teams Capacity" : "Max Participants Capacity"}
                value={formData.maxParticipants}
                onChange={handleChange}
                min="1"
              />

              {formData.isTeamEvent && (
                <div className="event-form-row">
                  <input 
                    className="event-form-input" 
                    type="number" 
                    inputMode="numeric" 
                    name="minTeamSize" 
                    placeholder="Min Team Size" 
                    value={formData.minTeamSize} 
                    onChange={handleChange} 
                    min="2" 
                    required 
                  />
                  <input 
                    className="event-form-input" 
                    type="number" 
                    inputMode="numeric" 
                    name="maxTeamSize" 
                    placeholder="Max Team Size" 
                    value={formData.maxTeamSize} 
                    onChange={handleChange} 
                    min="2" 
                    required 
                  />
                </div>
              )}

              <input 
                className="event-form-input" 
                type="number" 
                inputMode="numeric" 
                name="maxVolunteers" 
                placeholder="Max Volunteers Required" 
                value={formData.maxVolunteers} 
                onChange={handleChange} 
                min="1" 
              />
              
              <input 
                className="event-form-input" 
                type="number" 
                inputMode="numeric" 
                name="OrgCid" 
                placeholder="Club ID" 
                value={formData.OrgCid} 
                onChange={handleChange} 
                min="1" 
                required 
              />
              
              <input 
                className="event-form-input" 
                type="number" 
                inputMode="decimal" 
                name="registrationFee" 
                placeholder="Registration Fee (₹)" 
                value={formData.registrationFee} 
                onChange={handleChange} 
                step="0.01" 
                min="0" 
                required 
              />

              {parseFloat(formData.registrationFee) > 0 && (
                <input 
                  className="event-form-input" 
                  type="text" 
                  name="upiId" 
                  placeholder="Organizer UPI ID (e.g. name@okhdfcbank)" 
                  value={formData.upiId} 
                  onChange={handleChange} 
                  required 
                />
              )}
              
              <button className="event-form-button" type="submit">Publish Event</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventForm;


