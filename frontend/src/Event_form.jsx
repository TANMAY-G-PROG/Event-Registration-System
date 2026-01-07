import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './event_form.css';

const EventForm = () => {
  const navigate = useNavigate();
  
  // State for text fields (UNCHANGED)
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

  // State specifically for the file upload (UNCHANGED)
  const [bannerFile, setBannerFile] = useState(null); 
  
  // UI States (UNCHANGED)
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

  // Handle the Banner File selection (UNCHANGED)
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

    const submissionData = new FormData();
    
    // Append all text fields
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

    // Append the banner file if selected
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
        
        {/* Header - Replaces the split screen left side */}
        <div className="event-form-header">
           <h1 className="event-form-title">Create Event</h1>
           <p className="event-form-subtitle">Hey Organisers, fill in the details below.</p>
        </div>

        <form className="event-form-form" onSubmit={handleSubmit}>
          
          {/* CARD 1: Basic Info */}
          <div className="event-form-section">
            <div className="section-title">Event Details</div>
            
            <div className="event-form-group">
              <label className="event-form-label">Name</label>
              <input className="event-form-input" type="text" name="eventName" placeholder="Event Name" value={formData.eventName} onChange={handleChange} required />
            </div>

            <div className="event-form-group">
              <label className="event-form-label">Description</label>
              <textarea className="event-form-textarea" name="eventDescription" placeholder="Description" value={formData.eventDescription} onChange={handleChange} rows="3" required />
            </div>
            
             <div className="event-form-group">
               <label className="event-form-label">Certificate Info (Optional)</label>
               <textarea className="event-form-textarea" name="certificateInfo" placeholder="Certificate Info (Optional)" value={formData.certificateInfo} onChange={handleChange} rows="2" />
             </div>
          </div>

          {/* CARD 2: Media & Links */}
          <div className="event-form-section">
             <div className="section-title">Media & Links</div>
             
             {/* Brochure Link */}
             <div className="event-form-group">
               <label className="event-form-label">Event Brochure Link <span>(Optional)</span></label>
               <input 
                 className="event-form-input" 
                 type="url" 
                 name="posterUrl" 
                 placeholder="Paste Google Drive link here..." 
                 value={formData.posterUrl} 
                 onChange={handleChange} 
               />
               <small className="event-form-helper">
                 ℹ️ <strong>Google Drive:</strong> Share &rarr; General Access &rarr; "Anyone with the link" &rarr; Copy Link.
               </small>
             </div>

             {/* Banner Upload */}
             <div className="event-form-group">
               <label className="event-form-label">Event Banner <span>(Optional)</span></label>
               <div className="file-upload-box">
                 <input 
                   type="file" 
                   accept="image/*"
                   onChange={handleFileChange} 
                   style={{ width: '100%' }}
                 />
                 <small className="event-form-helper">
                   Max 5MB. This will be the main banner in the details page.
                 </small>
               </div>
             </div>
          </div>

          {/* CARD 3: Schedule & Location */}
          <div className="event-form-section">
             <div className="section-title">Schedule</div>
             <div className="form-grid-2">
                <div className="event-form-group">
                  <label className="event-form-label">Date</label>
                  <input className="event-form-input" type="date" name="eventDate" value={formData.eventDate} onChange={handleChange} required />
                </div>
                <div className="event-form-group">
                  <label className="event-form-label">Time</label>
                  <input className="event-form-input" type="time" name="eventTime" value={formData.eventTime} onChange={handleChange} required />
                </div>
             </div>
             <div className="event-form-group">
                <label className="event-form-label">Location</label>
                <input className="event-form-input" type="text" name="eventLocation" placeholder="Location" value={formData.eventLocation} onChange={handleChange} required />
             </div>
          </div>

          {/* CARD 4: Participation */}
          <div className="event-form-section">
             <div className="section-title">Participation</div>
             
             <label className="event-form-checkbox-group">
               <input type="checkbox" name="isTeamEvent" checked={formData.isTeamEvent} onChange={handleChange} className="event-form-checkbox" />
               <span className="event-form-checkbox-text">Team Event?</span>
             </label>

             <div className="form-grid-2">
               <div className="event-form-group">
                 <label className="event-form-label">{formData.isTeamEvent ? "Max Teams" : "Max Participants"}</label>
                 <input className="event-form-input" type="number" name="maxParticipants" placeholder={formData.isTeamEvent ? "Max Teams" : "Max Participants"} value={formData.maxParticipants} onChange={handleChange} min="1" />
               </div>
               <div className="event-form-group">
                 <label className="event-form-label">Club ID</label>
                 <input className="event-form-input" type="number" name="OrgCid" placeholder="Club ID" value={formData.OrgCid} onChange={handleChange} required />
               </div>
             </div>

             {formData.isTeamEvent && (
               <div className="form-grid-2">
                 <div className="event-form-group">
                   <label className="event-form-label">Min Team Size</label>
                   <input className="event-form-input" type="number" name="minTeamSize" placeholder="Min Size" value={formData.minTeamSize} onChange={handleChange} min="2" required />
                 </div>
                 <div className="event-form-group">
                   <label className="event-form-label">Max Team Size</label>
                   <input className="event-form-input" type="number" name="maxTeamSize" placeholder="Max Size" value={formData.maxTeamSize} onChange={handleChange} min="2" required />
                 </div>
               </div>
             )}
             
             <div className="event-form-group">
                <label className="event-form-label">Max Volunteers</label>
                <input className="event-form-input" type="number" name="maxVolunteers" placeholder="Max Volunteers" value={formData.maxVolunteers} onChange={handleChange} min="1" />
             </div>
          </div>

          {/* CARD 5: Payment */}
          <div className="event-form-section">
             <div className="section-title">Payment</div>
             <div className="form-grid-2">
                <div className="event-form-group">
                   <label className="event-form-label">Registration Fee (₹)</label>
                   <input className="event-form-input" type="number" name="registrationFee" placeholder="Fee (₹)" value={formData.registrationFee} onChange={handleChange} step="0.01" min="0" required />
                </div>
                {parseFloat(formData.registrationFee) > 0 && (
                  <div className="event-form-group">
                     <label className="event-form-label">UPI ID</label>
                     <input className="event-form-input" type="text" name="upiId" placeholder="UPI ID (e.g. name@upi)" value={formData.upiId} onChange={handleChange} required />
                  </div>
                )}
             </div>
          </div>

          {/* BUTTON - UNCHANGED TEXT */}
          <button className="event-form-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Uploading...' : 'Publish Event'}
          </button>

        </form>
      </div>
    </div>
  );
};

export default EventForm;
