import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './event_form.css';

const EventForm = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  
  // --- STATE MANAGEMENT ---
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 5;

  const [formData, setFormData] = useState({
    eventName: '',
    eventDescription: '',
    certificateInfo: '',
    posterUrl: '', // Google Drive Link
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
  const [bannerPreview, setBannerPreview] = useState(null);
  const [message, setMessage] = useState({ text: '', isError: false, show: false });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- HELPERS ---
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
        return;
      }
      setBannerFile(file);
      // Create preview URL
      const objectUrl = URL.createObjectURL(file);
      setBannerPreview(objectUrl);
    }
  };

  // --- STEP NAVIGATION & VALIDATION ---
  const validateStep = (step) => {
    switch(step) {
      case 1: // Basics
        return formData.eventName && formData.eventDescription;
      case 2: // Schedule
        return formData.eventDate && formData.eventTime && formData.eventLocation;
      case 3: // Participation
        if (formData.isTeamEvent) {
          return formData.minTeamSize && formData.maxTeamSize && formData.OrgCid;
        }
        return formData.OrgCid; 
      case 4: // Payment
        if (parseFloat(formData.registrationFee) > 0) return formData.upiId;
        return formData.registrationFee !== '';
      case 5: // Extras
        return true; // Optional fields
      default:
        return true;
    }
  };

  const nextStep = (e) => {
    e.preventDefault();
    if (!validateStep(currentStep)) {
      showMessage('Please fill in all required fields for this step.', true);
      return;
    }
    if (currentStep < totalSteps) {
      setCurrentStep(curr => curr + 1);
    }
  };

  const prevStep = (e) => {
    e.preventDefault();
    if (currentStep > 1) {
      setCurrentStep(curr => curr - 1);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    const submissionData = new FormData();
    Object.keys(formData).forEach(key => {
      submissionData.append(key, formData[key]);
    });
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

  // --- RENDER STEPS ---
  const renderStepContent = () => {
    switch(currentStep) {
      case 1:
        return (
          <div className="form-step-content fade-in">
            <h3 className="step-title">Event Basics</h3>
            <div className="input-group">
              <label>Event Name</label>
              <input className="premium-input" type="text" name="eventName" placeholder="e.g. Hackathon 2025" value={formData.eventName} onChange={handleChange} autoFocus />
            </div>
            <div className="input-group">
              <label>Short Description</label>
              <textarea className="premium-input premium-textarea" name="eventDescription" placeholder="What is this event about?" value={formData.eventDescription} onChange={handleChange} rows="4" />
            </div>
            <div className="input-group">
              <label>Event Banner <span className="optional-tag">(Optional)</span></label>
              <div 
                className={`file-drop-zone ${bannerPreview ? 'has-image' : ''}`}
                onClick={() => fileInputRef.current.click()}
                style={bannerPreview ? { backgroundImage: `url(${bannerPreview})` } : {}}
              >
                {!bannerPreview && (
                  <div className="drop-zone-content">
                    <span className="drop-icon">📷</span>
                    <p>Click to upload banner</p>
                    <small>Max size 5MB</small>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={fileInputRef}
                  accept="image/*" 
                  onChange={handleFileChange} 
                  style={{ display: 'none' }} 
                />
              </div>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="form-step-content fade-in">
            <h3 className="step-title">Schedule & Location</h3>
            <div className="form-row">
              <div className="input-group">
                <label>Date</label>
                <input className="premium-input" type="date" name="eventDate" value={formData.eventDate} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Time</label>
                <input className="premium-input" type="time" name="eventTime" value={formData.eventTime} onChange={handleChange} />
              </div>
            </div>
            <div className="input-group">
              <label>Location / Venue</label>
              <input className="premium-input" type="text" name="eventLocation" placeholder="e.g. Auditorium 1 / Google Meet" value={formData.eventLocation} onChange={handleChange} />
            </div>
          </div>
        );
      case 3:
        return (
          <div className="form-step-content fade-in">
            <h3 className="step-title">Participation Details</h3>
            
            <div className="toggle-container">
              <span>Is this a Team Event?</span>
              <label className="switch">
                <input type="checkbox" name="isTeamEvent" checked={formData.isTeamEvent} onChange={handleChange} />
                <span className="slider round"></span>
              </label>
            </div>

            {formData.isTeamEvent && (
              <div className="form-row fade-in">
                <div className="input-group">
                  <label>Min Team Size</label>
                  <input className="premium-input" type="number" name="minTeamSize" value={formData.minTeamSize} onChange={handleChange} min="2" />
                </div>
                <div className="input-group">
                  <label>Max Team Size</label>
                  <input className="premium-input" type="number" name="maxTeamSize" value={formData.maxTeamSize} onChange={handleChange} min="2" />
                </div>
              </div>
            )}

            <div className="form-row">
              <div className="input-group">
                <label>{formData.isTeamEvent ? "Max Teams" : "Max Participants"}</label>
                <input className="premium-input" type="number" name="maxParticipants" placeholder="Limit" value={formData.maxParticipants} onChange={handleChange} />
              </div>
              <div className="input-group">
                <label>Max Volunteers</label>
                <input className="premium-input" type="number" name="maxVolunteers" placeholder="Limit" value={formData.maxVolunteers} onChange={handleChange} />
              </div>
            </div>

            <div className="input-group">
              <label>Organization / Club ID</label>
              <input className="premium-input" type="number" name="OrgCid" placeholder="Your Club ID" value={formData.OrgCid} onChange={handleChange} />
            </div>
          </div>
        );
      case 4:
        return (
          <div className="form-step-content fade-in">
            <h3 className="step-title">Payment Info</h3>
            <div className="input-group">
              <label>Registration Fee (₹)</label>
              <input className="premium-input" type="number" name="registrationFee" placeholder="0 for free" value={formData.registrationFee} onChange={handleChange} min="0" step="0.01" />
            </div>
            
            {parseFloat(formData.registrationFee) > 0 && (
              <div className="input-group fade-in">
                <label>UPI ID for collection</label>
                <input className="premium-input" type="text" name="upiId" placeholder="username@oksbi" value={formData.upiId} onChange={handleChange} />
              </div>
            )}
          </div>
        );
      case 5:
        return (
          <div className="form-step-content fade-in">
            <h3 className="step-title">Extras</h3>
            <div className="input-group">
              <label>Brochure Link <span className="optional-tag">(Optional)</span></label>
              <input className="premium-input" type="url" name="posterUrl" placeholder="Google Drive Link" value={formData.posterUrl} onChange={handleChange} />
              <small className="helper-text">Make sure the link is set to "Anyone with the link can view"</small>
            </div>
            <div className="input-group">
              <label>Certificate Info <span className="optional-tag">(Optional)</span></label>
              <textarea className="premium-input premium-textarea" name="certificateInfo" placeholder="Details about certification criteria..." value={formData.certificateInfo} onChange={handleChange} rows="3" />
            </div>
            
            <div className="review-box">
              <p>Ready to publish <strong>{formData.eventName}</strong>?</p>
            </div>
          </div>
        );
      default: return null;
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
        <div className="event-form-card">
          
          {/* --- LEFT SIDE (UNCHANGED) --- */}
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

          {/* --- RIGHT SIDE (REDESIGNED) --- */}
          <div className="event-form-card-side event-form-right">
            
            {/* Header with Progress */}
            <div className="form-header">
              <h2>Create Event</h2>
              <div className="step-indicator">
                <div className="step-text">Step {currentStep} of {totalSteps}</div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${(currentStep / totalSteps) * 100}%` }}></div>
                </div>
              </div>
            </div>

            <form className="event-form-wizard" onSubmit={handleSubmit}>
              
              <div className="step-container">
                {renderStepContent()}
              </div>

              {/* Navigation Actions */}
              <div className="form-actions">
                {currentStep > 1 ? (
                  <button className="btn-secondary" onClick={prevStep}>Back</button>
                ) : (
                  <div></div> /* Spacer */
                )}

                {currentStep < totalSteps ? (
                  <button className="btn-primary" onClick={nextStep}>Next Step</button>
                ) : (
                  <button className="btn-primary btn-submit" type="submit" disabled={isSubmitting}>
                    {isSubmitting ? 'Publishing...' : 'Publish Event'}
                  </button>
                )}
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventForm;
