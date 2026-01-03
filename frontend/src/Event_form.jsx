import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './event_form.css';

const EventForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    eventName: '',
    eventDescription: '',
    certificateInfo: '',
    posterUrl: '', // Info/Brochure Link
    bannerUrl: '', // Visual Image Link
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
    setTimeout(() => setMessage({ text: '', isError: false, show: false }), 5000);
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const regFee = parseFloat(formData.registrationFee) || 0;

    const data = {
      eventName: formData.eventName,
      eventDescription: formData.eventDescription,
      certificate_info: formData.certificateInfo || null,
      posterUrl: formData.posterUrl || null, // Info Link
      bannerUrl: formData.bannerUrl || null, // Visual Link
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

    if (!data.eventName || !data.eventDescription || !data.eventDate || !data.eventTime || !data.eventLocation || !data.OrgCid) {
      showMessage('Please fill in all required fields.', true);
      return;
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
        setTimeout(() => navigate('/organisers'), 2000);
      } else {
        showMessage(`Failed: ${result.error}`, true);
      }
    } catch (err) {
      showMessage(`Error: ${err.message}`, true);
    }
  };

  return (
    <div className="event-form-container">
      {message.show && <div className={`event-form-message ${message.isError ? 'event-form-message-error' : 'event-form-message-success'}`}>{message.text}</div>}
      <div className="event-form-wrap event-form-registration">
        <div className="event-form-card">
          <div className="event-form-card-side event-form-left event-form-desktop-header">
            <div className="event-form-logo-text" data-text="Hey Organisers">Hey Organisers</div>
          </div>
          <div className="event-form-card-side event-form-right">
            <h2 className="event-form-title">Create Event</h2>
            <form className="event-form-form" onSubmit={handleSubmit}>
              <input className="event-form-input" type="text" name="eventName" placeholder="Event Name" value={formData.eventName} onChange={handleChange} required />
              <textarea className="event-form-textarea" name="eventDescription" placeholder="Description" value={formData.eventDescription} onChange={handleChange} rows="3" required />
              
              {/* --- LINK INPUTS --- */}
              <div style={{marginBottom: '20px'}}>
                <input 
                  className="event-form-input" 
                  type="url" 
                  name="bannerUrl" 
                  placeholder="Banner Image Link (Visual)" 
                  value={formData.bannerUrl} 
                  onChange={handleChange} 
                  style={{marginBottom: '5px'}}
                />
                <input 
                  className="event-form-input" 
                  type="url" 
                  name="posterUrl" 
                  placeholder="Brochure/Info Link (PDF/Docs)" 
                  value={formData.posterUrl} 
                  onChange={handleChange} 
                  style={{marginBottom: '5px'}}
                />
                <small style={{fontSize: '11px', color: '#666', display: 'block'}}>
                  Use "Share -> Anyone with link" for both. Banner should be an image file.
                </small>
              </div>

              <input className="event-form-input" type="date" name="eventDate" value={formData.eventDate} onChange={handleChange} required />
              <input className="event-form-input" type="time" name="eventTime" value={formData.eventTime} onChange={handleChange} required />
              <input className="event-form-input" type="text" name="eventLocation" placeholder="Location" value={formData.eventLocation} onChange={handleChange} required />
              
              {/* Checkbox for Team Event */}
              <div className="event-form-checkbox-group">
                <label className="event-form-checkbox-label">
                  <span className="event-form-checkbox-text">This is a Team Event</span>
                  <input type="checkbox" name="isTeamEvent" checked={formData.isTeamEvent} onChange={handleChange} className="event-form-checkbox" />
                </label>
              </div>

              <input className="event-form-input" type="number" name="maxParticipants" placeholder={formData.isTeamEvent ? "Max Teams" : "Max Participants"} value={formData.maxParticipants} onChange={handleChange} min="1" />

              {formData.isTeamEvent && (
                <div className="event-form-row">
                  <input className="event-form-input" type="number" name="minTeamSize" placeholder="Min Size" value={formData.minTeamSize} onChange={handleChange} min="2" required />
                  <input className="event-form-input" type="number" name="maxTeamSize" placeholder="Max Size" value={formData.maxTeamSize} onChange={handleChange} min="2" required />
                </div>
              )}

              <input className="event-form-input" type="number" name="OrgCid" placeholder="Club ID" value={formData.OrgCid} onChange={handleChange} required />
              <input className="event-form-input" type="number" name="registrationFee" placeholder="Fee (₹)" value={formData.registrationFee} onChange={handleChange} required />
              {parseFloat(formData.registrationFee) > 0 && <input className="event-form-input" type="text" name="upiId" placeholder="UPI ID" value={formData.upiId} onChange={handleChange} required />}
              
              <button className="event-form-button" type="submit">Publish Event</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
export default EventForm;
