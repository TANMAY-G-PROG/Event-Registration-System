import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ticket.css';

export default function OrganizerTicket() {
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userUSN, setUserUSN] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');

    if (!eventId) {
      setError('No event ID provided in the URL');
      setLoading(false);
      return;
    }

    fetchEventData(eventId);
  }, []);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/me', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: Failed to fetch user data`);
      }
      const data = await response.json();
      return data.userUSN;
    } catch (error) {
      console.error('Error fetching user data:', error);
      return null;
    }
  };

  const fetchEventData = async (eventId) => {
    try {
      const usn = await fetchUserData();
      if (!usn) {
        setError('User not authenticated. Please sign in.');
        setLoading(false);
        return;
      }
      setUserUSN(usn);

      const response = await fetch(`/api/events/${eventId}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.eid) {
        // Check if user is the organizer
        if (data.OrgUsn !== usn) {
          setError('You are not the organizer of this event.');
          setLoading(false);
          return;
        }
        setEventData(data);
        setLoading(false);
      } else {
        throw new Error('Invalid event data');
      }
    } catch (err) {
      console.error('Error fetching event:', err);
      setError(`Could not load event details. ${err.message}`);
      setLoading(false);
    }
  };

  const handleBack = () => {
    window.location.href = '/organisers';
  };

  const handleShowQR = () => {
    // Navigate to QR display page
    navigate(`/qr?eventId=${eventData.eid}`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'Not specified';
    const timeParts = timeString.split(':');
    let hours = parseInt(timeParts[0]);
    const minutes = timeParts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  return (
    <div className="ticket-page-wrapper">
      <div className="tk-nav-container">
        <button onClick={handleBack} className="tk-nav-btn">
          <i className="fas fa-arrow-left"></i>
          Back
        </button>
      </div>

      <div className="tk-ticket-container">
        {loading && (
          <div className="tk-loading-container">
            <div className="tk-spinner"></div>
            <p>Loading Ticket...</p>
          </div>
        )}

        {error && (
          <div className="tk-error-container">
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && eventData && (
          <div className="tk-ticket-card">
            {/* Texture Overlay */}
            <div className="tk-texture-overlay"></div>
            
            {/* Top Notch */}
            <div className="tk-top-notch"></div>

            <div className="tk-main-content">
              {/* Header */}
              <div className="tk-club-name">{eventData.clubName || 'Event Organizer'}</div>
              <h1 className="tk-event-title">{eventData.ename || 'Untitled Event'}</h1>
              
              {/* Divider */}
              <div className="tk-separator-dots"></div>

              {/* Grid Info */}
              <div className="tk-info-grid">
                <div>
                  <div className="tk-info-label">DATE</div>
                  <div className="tk-info-value">{formatDate(eventData.eventDate)}</div>
                </div>
                <div style={{textAlign: 'right'}}>
                  <div className="tk-info-label">TIME</div>
                  <div className="tk-info-value">{formatTime(eventData.eventTime)}</div>
                </div>
              </div>

              <div className="tk-info-grid">
                <div>
                  <div className="tk-info-label">LOCATION</div>
                  <div className="tk-info-value" style={{fontSize: '16px'}}>{eventData.eventLoc || 'TBD'}</div>
                </div>
                <div style={{textAlign: 'right'}}>
                  <div className="tk-info-label">EVENT ID</div>
                  <div className="tk-info-value">{eventData.eid}</div>
                </div>
              </div>

              {/* Stats for Organizer */}
              <div className="tk-info-grid">
                <div>
                  <div className="tk-info-label">CAPACITY</div>
                  <div className="tk-info-value">{eventData.maxPart}</div>
                </div>
                <div style={{textAlign: 'right'}}>
                  <div className="tk-info-label">VOLUNTEERS</div>
                  <div className="tk-info-value">{eventData.maxVoln}</div>
                </div>
              </div>

              {/* Description */}
              <p className="tk-details-text">
                {eventData.eventdesc || 'No description provided.'}
              </p>
            </div>

            {/* Tear-off Notches */}
            <div className="tk-notch-container">
              <div className="tk-notch tk-notch-left"></div>
              <div className="tk-notch tk-notch-right"></div>
            </div>

            {/* Footer / Stub - REPLACED WITH QR ACTION */}
            <div className="tk-stub-content">
              <button 
                onClick={handleShowQR}
                className="tk-scan-btn tk-org-btn"
              >
                <i className="fas fa-qrcode"></i>
                Show Event QR
              </button>
              <div className="tk-lock-msg" style={{color: '#666', fontWeight: '500'}}>
                For Attendance Scanning
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
