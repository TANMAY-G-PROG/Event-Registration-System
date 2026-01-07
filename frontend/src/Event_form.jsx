import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './event_form.css';

// --- Icons Component ---
const Icons = {
  Upload: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  Calendar: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  MapPin: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>,
  Users: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  CreditCard: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>,
  Link: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>,
  Check: () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  Sparkles: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00a578" strokeWidth="2"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" /></svg>
};

const EventForm = () => {
  const navigate = useNavigate();
  
  // State for text fields
  const [formData, setFormData] = useState({
    eventName: '',
    eventDescription: '',
    certificateInfo: '',
    posterUrl: '', 
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

  const [bannerFile, setBannerFile] = useState(null); 
  const [previewUrl, setPreviewUrl] = useState(null); 
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

  const handleToggle = () => {
    setFormData(prev => ({ ...prev, isTeamEvent: !prev.isTeamEvent }));
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
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
      
      {/* WRAPPER NOW TAKES FULL SCREEN */}
      <div className="event-form-wrap">
        
        {/* Header Section (Left Side - Full Height) */}
        <div className="event-form-card-side event-form-left event-form-desktop-header">
          <div className="event-form-logo-text">Hey Organisers</div>
        </div>
        
        {/* Mobile Header (Hidden on Desktop) */}
        <div className="event-form-card-side event-form-left event-form-mobile-header">
          <div className="event-form-left-header">
            <div className="event-form-glow-text">
              <span className="event-form-neon">Hey</span>
              <span className="event-form-neon event-form-neon-alt">Organisers</span>
            </div>
          </div>
        </div>

        {/* Form Section (Right Side - Full Height, Scrollable) */}
        <div className="event-form-card-side event-form-right">
          
          <h2 className="event-form-title">Create Event</h2>
          
          <form className="event-form-form" onSubmit={handleSubmit}>
            
            {/* --- SECTION 1: Event Details --- */}
            <div className="ef-card">
              <div className="ef-section-title">Event Basics</div>
              
              <div className="ef-group">
                <label className="ef-label">Event Name <span className="req">*</span></label>
                <input className="ef-input ef-input-lg" type="text" name="eventName" placeholder="Event Name" value={formData.eventName} onChange={handleChange} required />
              </div>
              
              <div className="ef-group">
                <label className="ef-label">Description</label>
                <textarea className="ef-textarea" name="eventDescription" placeholder="Description" value={formData.eventDescription} onChange={handleChange} rows="3" required />
              </div>

               <div className="ef-group">
                 <label className="ef-label">Certificate Info (Optional)</label>
                 <textarea className="ef-textarea" name="certificateInfo" placeholder="Certificate Info (Optional)" value={formData.certificateInfo} onChange={handleChange} rows="2" />
               </div>
            </div>

            {/* --- SECTION 2: Media & Links --- */}
            <div className="ef-card">
              <div className="ef-section-title">Media & Links</div>
              
              <div className="ef-group">
                <label className="ef-label">Event Brochure Link <span>(Optional)</span></label>
                <div className="ef-input-wrapper">
                  <span className="ef-input-icon"><Icons.Link /></span>
                  <input 
                    className="ef-input ef-pl" 
                    type="url" 
                    name="posterUrl" 
                    placeholder="Paste Google Drive link here..." 
                    value={formData.posterUrl} 
                    onChange={handleChange} 
                  />
                </div>
                <small className="ef-helper">
                  ℹ️ <strong>Google Drive:</strong> Share &rarr; General Access &rarr; "Anyone with the link" &rarr; Copy Link.
                </small>
              </div>

              <div className="ef-group">
                <label className="ef-label">Event Banner <span>(Optional)</span></label>
                <div className={`ef-upload-zone ${previewUrl ? 'has-file' : ''}`}>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleFileChange} 
                    id="banner-upload"
                  />
                  {previewUrl ? (
                    <div className="ef-preview-container">
                      <img src={previewUrl} alt="Preview" className="ef-banner-preview" />
                      <div className="ef-preview-overlay">
                        <Icons.Upload /> <span>Change Image</span>
                      </div>
                    </div>
                  ) : (
                    <div className="ef-upload-placeholder">
                      <div className="ef-upload-icon"><Icons.Upload /></div>
                      <p><strong>Click to upload</strong> or drag and drop</p>
                      <small className="ef-helper">Max 5MB. This will be the main banner in the details page.</small>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* --- SECTION 3: Schedule & Location --- */}
            <div className="ef-card">
              <h3 className="ef-section-title"><Icons.Calendar /> Schedule & Location</h3>
              <div className="ef-grid-2">
                <div className="ef-group">
                  <label className="ef-label">Date <span className="req">*</span></label>
                  <input className="ef-input" type="date" name="eventDate" value={formData.eventDate} onChange={handleChange} required />
                </div>
                <div className="ef-group">
                  <label className="ef-label">Time <span className="req">*</span></label>
                  <input className="ef-input" type="time" name="eventTime" value={formData.eventTime} onChange={handleChange} required />
                </div>
              </div>
              
              <div className="ef-group">
                <label className="ef-label">Location <span className="req">*</span></label>
                <div className="ef-input-wrapper">
                  <span className="ef-input-icon"><Icons.MapPin /></span>
                  <input 
                    className="ef-input ef-pl" 
                    type="text" 
                    name="eventLocation" 
                    placeholder="Location" 
                    value={formData.eventLocation} 
                    onChange={handleChange} 
                    required 
                  />
                </div>
              </div>
            </div>

            {/* --- SECTION 4: Participation --- */}
            <div className="ef-card">
              <div className="ef-header-row">
                <h3 className="ef-section-title"><Icons.Users /> Participation</h3>
                
                {/* Custom Toggle */}
                <div className="ef-toggle-wrapper" onClick={handleToggle}>
                   <span className="ef-toggle-label">Team Event?</span>
                   <div className={`ef-toggle ${formData.isTeamEvent ? 'active' : ''}`}>
                      <div className="ef-toggle-handle"></div>
                   </div>
                </div>
              </div>

              <div className="ef-grid-2">
                 <div className="ef-group">
                    <label className="ef-label">Club ID (OrgCID) <span className="req">*</span></label>
                    <input className="ef-input" type="number" name="OrgCid" value={formData.OrgCid} onChange={handleChange} required placeholder="Club ID" />
                 </div>
                 <div className="ef-group">
                    <label className="ef-label">{formData.isTeamEvent ? "Max Teams" : "Max Participants"}</label>
                    <input className="ef-input" type="number" name="maxParticipants" placeholder={formData.isTeamEvent ? "Max Teams" : "Max Participants"} value={formData.maxParticipants} onChange={handleChange} min="1" />
                 </div>
              </div>

              {formData.isTeamEvent && (
                <div className="ef-panel-anim">
                  <div className="ef-grid-2">
                    <div className="ef-group">
                      <label className="ef-label">Min Team Size</label>
                      <input className="ef-input" type="number" name="minTeamSize" placeholder="Min Size" value={formData.minTeamSize} onChange={handleChange} min="2" required />
                    </div>
                    <div className="ef-group">
                      <label className="ef-label">Max Team Size</label>
                      <input className="ef-input" type="number" name="maxTeamSize" placeholder="Max Size" value={formData.maxTeamSize} onChange={handleChange} min="2" required />
                    </div>
                  </div>
                </div>
              )}
               
               <div className="ef-group">
                  <label className="ef-label">Volunteers Needed</label>
                  <input className="ef-input" type="number" name="maxVolunteers" placeholder="Max Volunteers" value={formData.maxVolunteers} onChange={handleChange} min="1" />
               </div>
            </div>

            {/* --- SECTION 5: Payment --- */}
            <div className="ef-card">
              <h3 className="ef-section-title"><Icons.CreditCard /> Fees & Extras</h3>
              <div className="ef-grid-2">
                 <div className="ef-group">
                    <label className="ef-label">Registration Fee (₹) <span className="req">*</span></label>
                    <input className="ef-input" type="number" name="registrationFee" placeholder="Fee (₹)" value={formData.registrationFee} onChange={handleChange} step="0.01" min="0" required />
                 </div>
                 
                 {parseFloat(formData.registrationFee) > 0 && (
                   <div className="ef-group ef-fade-in">
                      <label className="ef-label">UPI ID for Collection</label>
                      <input className="ef-input" type="text" name="upiId" placeholder="UPI ID (e.g. name@upi)" value={formData.upiId} onChange={handleChange} required />
                   </div>
                 )}
              </div>
            </div>
            
            <button className="event-form-button" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Uploading...' : 'Publish Event'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
export default EventForm;
