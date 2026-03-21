import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './event_form.css';
import './style.css';

import { apiFetch } from './api.js';

const EventForm = () => {
  const navigate = useNavigate();

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
    maxTeamSize: '',
    maxActivityPts: '',
    volActivityPts: '',
    minPartScans: '',
    minVolnScans: ''
  });

  const [bannerFile, setBannerFile] = useState(null);
  const [message, setMessage] = useState({ text: '', isError: false, show: false });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myClubs, setMyClubs] = useState([]);
  const [isLoadingClubs, setIsLoadingClubs] = useState(true);

  useEffect(() => {
    const fetchMyClubs = async () => {
      try {
        const res = await apiFetch('/api/my-clubs');;
        if (res.ok) {
          const data = await res.json();
          setMyClubs(data.clubs || []);
        } else if (res.status === 401) {
          navigate('/');
        }
      } catch (err) {
        console.error("Failed to load memberships", err);
      } finally {
        setIsLoadingClubs(false);
      }
    };
    fetchMyClubs();
  }, [navigate]);

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
      showMessage('Please fill in all required fields, including the Organizing Club.', true);
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
    submissionData.append('activityPoints', formData.maxActivityPts || '0');
    submissionData.append('maxActivityPts', formData.maxActivityPts || '0');
    submissionData.append('volActivityPts', formData.volActivityPts || '0');
    submissionData.append('minPartScans', formData.minPartScans || '1');
    submissionData.append('minVolnScans', formData.minVolnScans || '1');

    if (bannerFile) {
      submissionData.append('banner', bannerFile);
    }

    try {
      const res = await apiFetch('/api/events/create', {
        method: 'POST',
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
        } else if (res.status === 403) {
          showMessage('You are not authorized to organize events for this club.', true);
          setIsSubmitting(false);
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

      {/* TOAST MESSAGE */}
      {message.show && (
        <div className={`flo-toast ${message.isError ? "flo-toast--error" : "flo-toast--success"}`}>
          <span className="flo-toast-icon">{message.isError ? "✕" : "✓"}</span>
          {message.text}
        </div>
      )}

      <div style={{ paddingBottom: 60 }} /> {/* Top Spacer for Nav */}
      <div className="event-form-wrap">
        <div className="event-form-mobile-header">
          <span className="event-form-neon">Create <span className="event-form-neon-alt">Event</span></span>
        </div>

        {/* BACK BTN */}
        <button className="back-button-top" onClick={() => navigate('/organisers')}>
          <i className="fas fa-arrow-left"></i> Back
        </button>

        {/* FORM CONTENT */}
        <div className="event-form-right">
          <div className="form-header">
            <h1 className="event-form-title">Create <span>Event</span></h1>
            <p className="form-subtitle">Fill in the details to publish your event on FLO</p>
          </div>

          <form onSubmit={handleSubmit}>

            {/* 01 — BASIC INFO */}
            <div className="event-form-section">
              <div className="section-label">
                <span className="section-label-num n1">01</span>
                <span className="section-label-text">Basic Info</span>
              </div>
              <div className="section-body">
                <div className="input-group">
                  <label className="input-label">Event Name <span className="req">*</span></label>
                  <input className="modern-input" type="text" name="eventName" placeholder="e.g. Tech Fest 2026" value={formData.eventName} onChange={handleChange} required />
                </div>
                <div className="input-group">
                  <label className="input-label">Description <span className="req">*</span></label>
                  <textarea className="modern-textarea" name="eventDescription" placeholder="What is this event about?" value={formData.eventDescription} onChange={handleChange} rows="3" required />
                </div>
                <div className="form-grid-2">
                  <div className="input-group">
                    <label className="input-label">Banner Image <span>(Optional)</span></label>
                    <div className="file-upload-area">
                      <input type="file" accept="image/*" onChange={handleFileChange} />
                      <div className="file-upload-text">
                        <i className="fas fa-image"></i>
                        Click to Upload · Max 5MB
                      </div>
                      {bannerFile && <div className="file-name-preview">✓ {bannerFile.name}</div>}
                    </div>
                  </div>
                  <div className="input-group">
                    <label className="input-label">Brochure Link <span>(Optional)</span></label>
                    <input className="modern-input" type="url" name="posterUrl" placeholder="https://drive.google.com/..." value={formData.posterUrl} onChange={handleChange} />
                    <span className="helper-text">Set Drive access to "Anyone with link"</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 02 — SCHEDULE */}
            <div className="event-form-section">
              <div className="section-label">
                <span className="section-label-num n2">02</span>
                <span className="section-label-text">Schedule & Location</span>
              </div>
              <div className="section-body">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label className="input-label">Date <span className="req">*</span></label>
                    <input className="modern-input" type="date" name="eventDate" value={formData.eventDate} onChange={handleChange} required />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Time <span className="req">*</span></label>
                    <input className="modern-input" type="time" name="eventTime" value={formData.eventTime} onChange={handleChange} required />
                  </div>
                </div>
                <div className="input-group">
                  <label className="input-label">Venue / Location <span className="req">*</span></label>
                  <input className="modern-input" type="text" name="eventLocation" placeholder="e.g. Auditorium A, Main Block" value={formData.eventLocation} onChange={handleChange} required />
                </div>
              </div>
            </div>

            {/* 03 — PARTICIPATION */}
            <div className="event-form-section">
              <div className="section-label">
                <span className="section-label-num n3">03</span>
                <span className="section-label-text">Participation</span>
              </div>
              <div className="section-body">
                <label className="toggle-wrapper">
                  <span className="toggle-label">Team Event?</span>
                  <input type="checkbox" name="isTeamEvent" checked={formData.isTeamEvent} onChange={handleChange} className="toggle-checkbox" />
                </label>
                <div className={`conditional-fields ${formData.isTeamEvent ? 'open' : ''}`}>
                  <div className="conditional-inner">
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
                </div>
                <div className="form-grid-2">
                  <div className="input-group">
                    <label className="input-label">{formData.isTeamEvent ? 'Max Teams' : 'Max Participants'}</label>
                    <input className="modern-input" type="number" name="maxParticipants" placeholder="0 = Unlimited" value={formData.maxParticipants} onChange={handleChange} min="1" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Volunteers Needed</label>
                    <input className="modern-input" type="number" name="maxVolunteers" placeholder="0" value={formData.maxVolunteers} onChange={handleChange} min="0" />
                  </div>
                </div>
              </div>
            </div>

            {/* 04 — PAYMENTS */}
            <div className="event-form-section">
              <div className="section-label">
                <span className="section-label-num n4">04</span>
                <span className="section-label-text">Payments & Club</span>
              </div>
              <div className="section-body">
                <div className="form-grid-2">
                  <div className="input-group">
                    <label className="input-label">Organizing Club <span className="req">*</span></label>
                    {isLoadingClubs ? (
                      <div className="club-loading">Fetching your clubs...</div>
                    ) : myClubs.length > 0 ? (
                      <select className="modern-select" name="OrgCid" value={formData.OrgCid} onChange={handleChange} required>
                        <option value="">— Select Club —</option>
                        {myClubs.map(club => (
                          <option key={club.cid} value={club.cid}>{club.cname || `Club ${club.cid}`}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="club-error">⚠ Not a member of any club</div>
                    )}
                  </div>
                  <div className="input-group">
                    <label className="input-label">Registration Fee (₹) <span className="req">*</span></label>
                    <input className="modern-input" type="number" name="registrationFee" placeholder="0" value={formData.registrationFee} onChange={handleChange} step="0.01" min="0" required />
                  </div>
                </div>
                <div className={`conditional-fields ${parseFloat(formData.registrationFee) > 0 ? 'open' : ''}`}>
                  <div className="conditional-inner">
                    <div className="input-group">
                      <label className="input-label">UPI ID for Payment</label>
                      <input className="modern-input" type="text" name="upiId" placeholder="merchant@upi" value={formData.upiId} onChange={handleChange} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 05 — EXTRAS */}
            <div className="event-form-section">
              <div className="section-label">
                <span className="section-label-num n5">05</span>
                <span className="section-label-text">Activity Points & Extras</span>
              </div>
              <div className="section-body">
                <div className="input-group">
                  <label className="input-label">Certificate Info <span>(Optional)</span></label>
                  <textarea className="modern-textarea" name="certificateInfo" placeholder="Text to display on the certificate" value={formData.certificateInfo} onChange={handleChange} rows="2" />
                </div>
                <div className="form-grid-2">
                  <div className="input-group">
                    <label className="input-label">Max Activity Pts — Participants</label>
                    <input className="modern-input" type="number" name="maxActivityPts" placeholder="0 = disabled" value={formData.maxActivityPts} onChange={handleChange} min="0" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Activity Pts — Volunteers</label>
                    <input className="modern-input" type="number" name="volActivityPts" placeholder="0 = disabled" value={formData.volActivityPts} onChange={handleChange} min="0" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Min Scans — Participant</label>
                    <input className="modern-input" type="number" name="minPartScans" placeholder="1" value={formData.minPartScans} onChange={handleChange} min="1" />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Min Scans — Volunteer</label>
                    <input className="modern-input" type="number" name="minVolnScans" placeholder="1" value={formData.minVolnScans} onChange={handleChange} min="1" />
                  </div>
                </div>
                <span className="helper-text">Set min scans to 1 for single-scan attendance. Increase for multi-session events.</span>
              </div>
            </div>

            {/* SUBMIT */}
            <div className="submit-btn-container">
              <button
                className="event-form-button"
                type="submit"
                disabled={isSubmitting || (myClubs.length === 0 && !isLoadingClubs)}
              >
                {isSubmitting ? 'Publishing...' : <><i className="fas fa-rocket"></i> Publish Event</>}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default EventForm;