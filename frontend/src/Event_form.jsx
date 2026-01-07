import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './event_form.css';

const EventForm = () => {
  const navigate = useNavigate();
  
  // State for text fields
  const [formData, setFormData] = useState({
    eventName: '',
    eventDescription: '',
    certificateInfo: '',
    posterUrl: '', // Stores the Google Drive Link
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

  // State specifically for the file upload
  const [bannerFile, setBannerFile] = useState(null); 
  
  // UI States
  const [message, setMessage] = useState({ text: '', isError: false, show: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { 
        showMessage('Banner image is too large (Max 5MB).', true);
        e.target.value = null;
        setBannerFile(null);
        return;
      }
      setBannerFile(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    if (!formData.eventName || !formData.eventDate || !formData.OrgCid) {
      showMessage('Please fill in all required fields.', true);
      setIsSubmitting(false);
      return;
    }

    const submissionData = new FormData();
    submissionData.append('eventName', formData.eventName);
    submissionData.append('eventDescription', formData.eventDescription);
    submissionData.append('certificate_info', formData.certificateInfo || '');
    submissionData.append('posterUrl', formData.posterUrl || '');
    submissionData.append('eventDate', formData.eventDate);
    submissionData.append('eventTime', formData.eventTime);
    submissionData.append('eventLocation', formData.eventLocation);
    submissionData.append('maxParticipants', formData.maxParticipants || '');
    submissionData.append('maxVolunteers', formData.maxVolunteers || '');
    submissionData.append('OrgCid', formData.OrgCid);
    submissionData.append('registrationFee', formData.registrationFee || '0');
    submissionData.append('upiId', formData.upiId || '');
    submissionData.append('isTeamEvent', formData.isTeamEvent);
    submissionData.append('minTeamSize', formData.minTeamSize || '');
    submissionData.append('maxTeamSize', formData.maxTeamSize || '');

    if (bannerFile) {
      submissionData.append('banner', bannerFile);
    }

    try {
      const res = await fetch('/api/events/create', {
        method: 'POST',
        credentials: 'include',
        body: submissionData 
      });

      const result = await res.json();
      
      if (res.ok) {
        showMessage('Event published successfully!');
        setTimeout(() => navigate('/organisers'), 2000);
      } else {
        if (res.status === 401) {
          showMessage('Session expired. Please login again.', true);
          setTimeout(() => navigate('/'), 2000);
        } else {
          showMessage(result.error || 'Failed to create event', true);
          setIsSubmitting(false);
        }
      }
    } catch (err) {
      showMessage(`Network Error: ${err.message}`, true);
      setIsSubmitting(false);
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
        
        {/* === LEFT SIDE (Branding) === */}
        <div className="event-form-left">
          <div className="event-form-logo-text">Hey Organisers</div>
        </div>
        
        {/* === MOBILE HEADER === */}
        <div className="event-form-mobile-header">
           <span className="event-form-neon">Hey</span>
           <span className="event-form-neon event-form-neon-alt">Organisers</span>
        </div>

        {/* === RIGHT SIDE (Form) === */}
        <div className="event-form-right">
          
          <div className="form-header">
            <h2 className="event-form-title">Create Event</h2>
            <div className="form-subtitle">Fill in the details to launch your new event.</div>
          </div>
          
          <form onSubmit={handleSubmit}>
            
            {/* --- SECTION 1: EVENT BASICS --- */}
            <div className="event-form-section">
              <span className="section-label">01. Event Basics</span>
              
              <div className="input-group">
                <label className="input-label">Event Name</label>
                <input 
                  className="modern-input" 
                  type="text" 
                  name="eventName" 
                  placeholder="e.g. Annual Tech Hackathon" 
                  value={formData.eventName} 
                  onChange={handleChange} 
                  required 
                />
              </div>

              <div className="input-group">
                <label className="input-label">Description</label>
                <textarea 
                  className="modern-textarea" 
                  name="eventDescription" 
                  placeholder="What is this event about?" 
                  value={formData.eventDescription} 
                  onChange={handleChange} 
                  rows="3" 
                  required 
                />
              </div>

              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Banner Image <span>(Optional)</span></label>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileChange} 
                    className="modern-input"
                    style={{ padding: '10px' }}
                  />
                  <div className="helper-text">Max 5MB. Jpeg/Png.</div>
                </div>

                <div className="input-group">
                  <label className="input-label">Brochure Link (Drive) <span>(Optional)</span></label>
                  <input 
                    className="modern-input" 
                    type="url" 
                    name="posterUrl" 
                    placeholder="https://drive.google.com..." 
                    value={formData.posterUrl} 
                    onChange={handleChange} 
                  />
                  <div className="helper-text">Set access to "Anyone with link".</div>
                </div>
              </div>
            </div>

            {/* --- SECTION 2: SCHEDULE & LOCATION --- */}
            <div className="event-form-section">
              <span className="section-label">02. Schedule & Location</span>
              
              <div className="form-grid-2">
                <div className="input-group">
                  <label className="input-label">Date</label>
                  <input 
                    className="modern-input" 
                    type="date" 
                    name="eventDate" 
                    value={formData.eventDate} 
                    onChange={handleChange} 
                    required 
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">Time</label>
                  <input 
                    className="modern-input" 
                    type="time" 
                    name="eventTime" 
                    value={formData.eventTime} 
                    onChange={handleChange} 
                    required 
                  />
                </div>
              </div>

              <div className="input-group">
                <label className="input-label">Venue / Location</label>
                <input 
                  className="modern-input" 
                  type="text" 
                  name="eventLocation" 
                  placeholder="e.g. Auditorium A, Main Block" 
                  value={formData.eventLocation} 
                  onChange={handleChange} 
                  required 
                />
              </div>
            </div>

            {/* --- SECTION 3: PARTICIPATION --- */}
            <div className="event-form-section">
              <span className="section-label">03. Participation</span>

              <div className="input-group">
                <label className="toggle-wrapper">
                  <span className="toggle-label">Is this a Team Event?</span>
                  <input 
                    type="checkbox" 
                    name="isTeamEvent" 
                    checked={formData.isTeamEvent} 
                    onChange={handleChange} 
                    className="toggle-checkbox" 
                  />
                </label>
              </div>

              <div className={`conditional-fields ${formData.isTeamEvent ? 'open' : ''}`}>
                <div className="form-grid-2">
                   <div className="input-group">
                      <label className="input-label">Min Team Size</label>
                      <input className="modern-input" type="number" name="minTeamSize" placeholder="2" value={formData.minTeamSize} onChange={handleChange} min="2" />
                   </div>
                   <div className="input-group">
                      <label className="input-label">Max Team Size</label>
                      <input className="modern-input" type="number" name="maxTeamSize" placeholder="5" value={formData.maxTeamSize} onChange={handleChange} min="2" />
                   </div>
                </div>
              </div>

              <div className="form-grid-2" style={{ marginTop: '16px' }}>
                <div className="input-group">
                  <label className="input-label">{formData.isTeamEvent ? "Max Teams" : "Max Participants"}</label>
                  <input className="modern-input" type="number" name="maxParticipants" placeholder="0 = Unlimited" value={formData.maxParticipants} onChange={handleChange} min="1" />
                </div>
                <div className="input-group">
                  <label className="input-label">Volunteers Needed</label>
                  <input className="modern-input" type="number" name="maxVolunteers" placeholder="0" value={formData.maxVolunteers} onChange={handleChange} min="1" />
                </div>
              </div>
            </div>

            {/* --- SECTION 4: PAYMENTS --- */}
            <div className="event-form-section">
              <span className="section-label">04. Payments & ID</span>
              
              <div className="form-grid-2">
                 <div className="input-group">
                  <label className="input-label">Club ID (OrgCid)</label>
                  <input className="modern-input" type="number" name="OrgCid" placeholder="ID" value={formData.OrgCid} onChange={handleChange} required />
                 </div>
                 <div className="input-group">
                  <label className="input-label">Registration Fee (₹)</label>
                  <input className="modern-input" type="number" name="registrationFee" placeholder="0" value={formData.registrationFee} onChange={handleChange} step="0.01" min="0" required />
                 </div>
              </div>

              <div className={`conditional-fields ${parseFloat(formData.registrationFee) > 0 ? 'open' : ''}`}>
                <div className="input-group">
                  <label className="input-label">UPI ID for Payment</label>
                  <input className="modern-input" type="text" name="upiId" placeholder="merchant@upi" value={formData.upiId} onChange={handleChange} />
                </div>
              </div>
            </div>

            {/* --- SECTION 5: EXTRAS --- */}
            <div className="event-form-section">
              <span className="section-label">05. Extras</span>
              <div className="input-group">
                <label className="input-label">Certificate Information <span>(Optional)</span></label>
                <textarea 
                  className="modern-textarea" 
                  name="certificateInfo" 
                  placeholder="Text to be displayed on the certificate" 
                  value={formData.certificateInfo} 
                  onChange={handleChange} 
                  rows="2" 
                />
              </div>
            </div>

            {/* --- SUBMIT --- */}
            <div className="submit-btn-container">
              <button className="event-form-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Publishing Event...' : 'Publish Event'}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default EventForm;


