import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ticket.css';

export default function VolunteerTicket() {
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
      const response = await fetch('http://localhost:3000/api/me', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch user data`);
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

      const response = await fetch('http://localhost:3000/api/my-volunteer-events', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch volunteer events');
      }

      const data = await response.json();
      let foundEvent = null;

      // Search in array format
      if (data.volunteerEvents && Array.isArray(data.volunteerEvents)) {
        foundEvent = data.volunteerEvents.find(
          (event) => event.eid == eventId || event.id == eventId
        );
      }
      // Search in object format with categories
      else if (data.volunteerEvents && typeof data.volunteerEvents === 'object') {
        for (const category of ['ongoing', 'completed', 'upcoming']) {
          if (
            data.volunteerEvents[category] &&
            Array.isArray(data.volunteerEvents[category])
          ) {
            foundEvent = data.volunteerEvents[category].find(
              (event) => event.eid == eventId || event.id == eventId
            );
            if (foundEvent) break;
          }
        }
      }

      if (foundEvent) {
        setEventData(foundEvent);
        setLoading(false);
      } else {
        setError(`Could not load event details. Event ID: ${eventId} not found.`);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching event:', err);
      setError('Unable to load event details. Please try again.');
      setLoading(false);
    }
  };

  const handleBack = () => {
    window.location.href = '/volunteers.html';
  };

  const handleScanQR = () => {
    // Volunteer scans organizer's QR code to mark attendance
    navigate(`/scanner?role=volunteer`);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
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
      <div className="tk-background-glow"></div>

      <div className="tk-nav-container">
        <button onClick={handleBack} className="tk-nav-btn">
          <i className="fas fa-arrow-left"></i>
          Back
        </button>
      </div>

      <div className="tk-ticket-container">
        {loading && (
          <div className="tk-loading-spinner">
            <div className="tk-spinner"></div>
          </div>
        )}

        {error && (
          <div className="tk-error-message">
            <h3>Error Loading Event</h3>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && eventData && (
          <div className="tk-ticket-card">
            <div className="tk-ticket-header">
              <h1 className="tk-event-title">
                {eventData.ename || eventData.name || 'Untitled Event'}
              </h1>
              <p className="tk-event-id">Event ID: {eventData.eid || eventData.id}</p>
              {userUSN && <p className="tk-user-badge">🤝 Volunteer: {userUSN}</p>}
            </div>

            <div className="tk-ticket-content">
              <div className="tk-info-section">
                <div className="tk-info-icon">📅</div>
                <div className="tk-info-content">
                  <h3>Date</h3>
                  <p>{formatDate(eventData.eventDate || eventData.date)}</p>
                </div>
              </div>

              <div className="tk-info-section">
                <div className="tk-info-icon">⏰</div>
                <div className="tk-info-content">
                  <h3>Time</h3>
                  <p>{formatTime(eventData.eventTime || eventData.time)}</p>
                </div>
              </div>

              <div className="tk-info-section">
                <div className="tk-info-icon">📍</div>
                <div className="tk-info-content">
                  <h3>Location</h3>
                  <p>{eventData.eventLoc || eventData.location || 'Location TBD'}</p>
                </div>
              </div>

              <div className="tk-info-section">
                <div className="tk-info-icon">👥</div>
                <div className="tk-info-content">
                  <h3>Max Participants</h3>
                  <p>{eventData.maxPart || eventData.maxParticipants || 'No limit'}</p>
                </div>
              </div>

              <div className="tk-info-section">
                <div className="tk-info-icon">🤝</div>
                <div className="tk-info-content">
                  <h3>Max Volunteers</h3>
                  <p>{eventData.maxVoln || eventData.maxVolunteers || 'No limit'}</p>
                </div>
              </div>

              <div className="tk-info-section">
                <div className="tk-info-icon">💰</div>
                <div className="tk-info-content">
                  <h3>Registration Fee</h3>
                  <p>₹{eventData.regFee || eventData.registrationFee || '0'}</p>
                </div>
              </div>

              {(eventData.clubName || eventData.club) && (
                <div className="tk-info-section">
                  <div className="tk-info-icon">🏛️</div>
                  <div className="tk-info-content">
                    <h3>Organized by</h3>
                    <p>{eventData.clubName || eventData.club}</p>
                  </div>
                </div>
              )}

              <div className="tk-description-section">
                <h3>Event Description</h3>
                <p>{eventData.eventdesc || eventData.description || 'No description available'}</p>
              </div>
            </div>

            <div className="tk-ticket-footer">
              <button
                onClick={handleScanQR}
                className="tk-qr-placeholder tk-qr-scanner"
                title="Scan Event QR Code"
              >
                📱
                <div className="tk-qr-text">SCAN EVENT QR</div>
              </button>
              <p style={{ marginTop: '10px', fontSize: '12px', color: '#666' }}>
                Scan the organizer's QR code to mark your attendance
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}