import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './event_form.css';

const EventForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    eventName: '',
    eventDescription: '',
    certificateInfo: '',
    posterUrl: '',
    bannerUrl: '', // NEW FIELD
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
      posterUrl: formData.posterUrl || null,
      bannerUrl: formData.bannerUrl || null, // SEND BANNER TO BACKEND
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
          eventName: '', eventDescription: '', certificateInfo: '', posterUrl: '', bannerUrl: '',
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
      
     <div className="event-form-wrap">
       <div className="event-form-card event-form-registration">
          {/* DESKTOP HEADER */}
         <div className="event-form-card-side event-form-left event-form-desktop-header">
           <div className="event-form-logo-text">
              Hey<br />Organisers
           </div>
         </div>

          {/* MOBILE HEADER */}
         <div className="event-form-mobile-header">
           <div className="event-form-left-header">
             <div className="event-form-glow-text">
               <span className="event-form-neon">Hey</span>
               <span className="event-form-neon-alt">Organisers</span>
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
                placeholder="Event Description"
                value={formData.eventDescription}
                onChange={handleChange}
                required
              />
              <input
                className="event-form-input"
                type="text"
                name="certificateInfo"
                placeholder="Certificate Information (Optional)"
                value={formData.certificateInfo}
                onChange={handleChange}
              />

              {/* POSTER URL INPUT */}
              <input
                className="event-form-input"
                type="url"
                name="posterUrl"
                placeholder="Poster URL (Optional - Google Drive link)"
                value={formData.posterUrl}
                onChange={handleChange}
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '-16px', marginBottom: '8px' }}>
                Upload to Drive > Right Click > Share > Copy Link (Anyone with link)
              </div>

              {/* BANNER URL INPUT - NEW */}
              <input
                className="event-form-input"
                type="url"
                name="bannerUrl"
                placeholder="Banner Image URL (Optional - Google Drive link)"
                value={formData.bannerUrl}
                onChange={handleChange}
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '-16px', marginBottom: '8px' }}>
                Banner will be displayed at the top of event registration page
              </div>

              <input
                className="event-form-input"
                type="date"
                name="eventDate"
                value={formData.eventDate}
                onChange={handleChange}
                required
              />
              <input
                className="event-form-input"
                type="time"
                name="eventTime"
                value={formData.eventTime}
                onChange={handleChange}
                required
              />
              <input
                className="event-form-input"
                type="text"
                name="eventLocation"
                placeholder="Event Location"
                value={formData.eventLocation}
                onChange={handleChange}
                required
              />
              <input
                className="event-form-input"
                type="number"
                name="maxParticipants"
                placeholder="Max Participants (Optional)"
                value={formData.maxParticipants}
                onChange={handleChange}
              />
              <input
                className="event-form-input"
                type="number"
                name="maxVolunteers"
                placeholder="Max Volunteers (Optional)"
                value={formData.maxVolunteers}
                onChange={handleChange}
              />
              <input
                className="event-form-input"
                type="number"
                name="OrgCid"
                placeholder="Club ID"
                value={formData.OrgCid}
                onChange={handleChange}
                required
              />

              <div className="event-form-checkbox-group">
                <label className="event-form-checkbox-label">
                  <span className="event-form-checkbox-text">This is a Team Event</span>
                  <input
                    className="event-form-checkbox"
                    type="checkbox"
                    name="isTeamEvent"
                    checked={formData.isTeamEvent}
                    onChange={handleChange}
                  />
                </label>
              </div>

              {formData.isTeamEvent && (
               <div className="event-form-row">
                  <input
                    className="event-form-input"
                    type="number"
                    name="minTeamSize"
                    placeholder="Min Team Size"
                    value={formData.minTeamSize}
                    onChange={handleChange}
                    min="2"
                  />
                  <input
                    className="event-form-input"
                    type="number"
                    name="maxTeamSize"
                    placeholder="Max Team Size"
                    value={formData.maxTeamSize}
                    onChange={handleChange}
                    min="2"
                  />
               </div>
              )}

              <input
                className="event-form-input"
                type="number"
                name="registrationFee"
                placeholder="Registration Fee (0 for Free)"
                value={formData.registrationFee}
                onChange={handleChange}
                step="0.01"
              />

              {parseFloat(formData.registrationFee) > 0 && (
                <input
                  className="event-form-input"
                  type="text"
                  name="upiId"
                  placeholder="UPI ID (Required for paid events)"
                  value={formData.upiId}
                  onChange={handleChange}
                  required
                />
              )}

              <button className="event-form-button" type="submit">
                Publish Event
              </button>
           </form>
         </div>
       </div>
     </div>
   </div>
  );
};

export default EventForm;
