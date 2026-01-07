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
    posterUrl: '', // Text input for Google Drive Link (optional)
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

  // Handle the Banner File selection
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Check file size (5MB limit matches backend)
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

    // Basic Validation
    if (!formData.eventName || !formData.eventDate || !formData.OrgCid) {
      showMessage('Please fill in all required fields.', true);
      setIsSubmitting(false);
      return;
    }

    // Use FormData to handle text + file
    const submissionData = new FormData();
    
    // Append all text fields
    submissionData.append('eventName', formData.eventName);
    submissionData.append('eventDescription', formData.eventDescription);
    submissionData.append('certificate_info', formData.certificateInfo || '');
    submissionData.append('posterUrl', formData.posterUrl || ''); // Google Drive Link
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

    // Append the file if one was selected
    if (bannerFile) {
      submissionData.append('banner', bannerFile); // Key must match 'upload.single("banner")' in server.js
    }

    try {
      const res = await fetch('/api/events/create', {
        method: 'POST',
        credentials: 'include',
        // Note: Do NOT set Content-Type header manually for FormData; browser does it automatically
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
      
      <div className="event-form-wrap event-form-registration">
        <div className="event-form-card">
          {/* Header Sections */}
          <div className="event-form-card-side event-form-left event-form-desktop-header">
            <div className="event-form-logo-text">Hey Organisers</div>
          </div>
          <div className="event-form-card-side event-form-left event-form-mobile-header">
            <div className="event-form-left-header">
              <div className="event-form-glow-text">
                <span className="event-form-neon">Hey</span>
                <span className="event-form-neon event-form-neon-alt">Organisers</span>
              </div>
            </div>
          </div>

          {/* Form Section */}
          <div className="event-form-card-side event-form-right">
            <h2 className="event-form-title">Create Event</h2>
            <form className="event-form-form" onSubmit={handleSubmit}>
              
              <input className="event-form-input" type="text" name="eventName" placeholder="Event Name" value={formData.eventName} onChange={handleChange} required />
              
              <textarea className="event-form-textarea" name="eventDescription" placeholder="Description" value={formData.eventDescription} onChange={handleChange} rows="3" required />
              
              {/* --- 1. OPTIONAL POSTER LINK (Google Drive) --- */}
              <input 
                className="event-form-input" 
                type="url" 
                name="Event Brochure" 
                placeholder="Google Drive Poster Link (Optional)" 
                value={formData.posterUrl} 
                onChange={handleChange} 
              />

              {/* --- 2. OPTIONAL BANNER UPLOAD (Cloudinary) --- */}
              <div style={{marginBottom: '22px'}}>
                <label style={{fontSize: '14px', fontWeight: '600', color: '#333', marginBottom: '8px', display: 'block'}}>
                  Event Banner (Optional)
                </label>
                <div style={{background: '#f0f0f0', padding: '10px', borderRadius: '8px', border: '1px dashed #ccc'}}>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileChange} 
                    style={{width: '100%', fontSize: '13px'}}
                  />
                  <small style={{fontSize: '11px', color: '#666', marginTop: '4px', display: 'block'}}>
                    Max 5MB. This will be the main banner in the details page.
                  </small>
                </div>
              </div>

              <textarea className="event-form-textarea" name="certificateInfo" placeholder="Certificate Info (Optional)" value={formData.certificateInfo} onChange={handleChange} rows="2" />
              
              <input className="event-form-input" type="date" name="eventDate" value={formData.eventDate} onChange={handleChange} required />
              <input className="event-form-input" type="time" name="eventTime" value={formData.eventTime} onChange={handleChange} required />
              <input className="event-form-input" type="text" name="eventLocation" placeholder="Location" value={formData.eventLocation} onChange={handleChange} required />
              
              <div className="event-form-checkbox-group">
                <label className="event-form-checkbox-label">
                  <span className="event-form-checkbox-text">Team Event?</span>
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

              <input className="event-form-input" type="number" name="maxVolunteers" placeholder="Max Volunteers" value={formData.maxVolunteers} onChange={handleChange} min="1" />
              <input className="event-form-input" type="number" name="OrgCid" placeholder="Club ID" value={formData.OrgCid} onChange={handleChange} required />
              
              <input className="event-form-input" type="number" name="registrationFee" placeholder="Fee (₹)" value={formData.registrationFee} onChange={handleChange} step="0.01" min="0" required />
              
              {parseFloat(formData.registrationFee) > 0 && (
                <input className="event-form-input" type="text" name="upiId" placeholder="UPI ID (e.g. name@upi)" value={formData.upiId} onChange={handleChange} required />
              )}
              
              <button className="event-form-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Uploading...' : 'Publish Event'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
export default EventForm;

