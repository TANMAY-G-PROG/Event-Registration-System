import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './ticket.css';

export default function VolunteerTicket() {
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userUSN, setUserUSN] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      setError('No event ID provided in the URL');
      setLoading(false);
      return;
    }

    fetchEventData(eventId);
  }, [searchParams]);

  const fetchUserData = async () => {
    try {
      const response = await fetch('/api/me', {
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

      const response = await fetch('/api/my-volunteer-events', {
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/');
        }
        throw new Error('Failed to fetch volunteer events');
      }

      const data = await response.json();
      let foundEvent = null;

      // Search logic (Array or Object format)
      if (data.volunteerEvents && Array.isArray(data.volunteerEvents)) {
        foundEvent = data.volunteerEvents.find(
          (event) => event.eid == eventId || event.id == eventId
        );
      } else if (data.volunteerEvents && typeof data.volunteerEvents === 'object') {
        for (const category of ['ongoing', 'completed', 'upcoming']) {
          if (data.volunteerEvents[category] && Array.isArray(data.volunteerEvents[category])) {
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
        setError(`Could not load event details. Event ID: ${eventId} not found or you are not a volunteer.`);
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching event:', err);
      setError('Unable to load event details. Please try again.');
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/volunteers');
  };

  const handleScanQR = () => {
    navigate(`/scanner?role=volunteer`);
  };

  // Helper formats
  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'TBD';
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
      
      {/* Glassy Back Button */}
      <div className="tk-nav-container">
        <button onClick={handleBack} className="tk-nav-btn">
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="tk-loading-container">
            <p>Loading Ticket...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="tk-error-container">
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      )}

      {/* Main Ticket */}
      {!loading && !error && eventData && (
        <div className="tk-ticket-container">
          <div className="tk-ticket-card">
            
            {/* Texture Overlay */}
            <div className="tk-texture-overlay"></div>
            
            <div className="tk-top-notch"></div>

            <div className="tk-main-content">
              
              {/* Title & Organization */}
              <h1 className="tk-event-title">
                {eventData.ename || eventData.name || 'Untitled Event'}
              </h1>
              
              {/* User Badge */}
              {userUSN && <div className="tk-volunteer-badge">Volunteer: {userUSN}</div>}

              {/* Club Name */}
              <div className="tk-club-name">
                 {eventData.clubName || eventData.club || 'Event Organizer'}
              </div>

              <div className="tk-separator-dots"></div>

              {/* Info Grid */}
              <div className="tk-info-grid">
                  <div>
                    <div className="tk-info-label">Date</div>
                    <div className="tk-info-value">{formatDate(eventData.eventDate || eventData.date)}</div>
                  </div>
                  <div>
                    <div className="tk-info-label">Time</div>
                    <div className="tk-info-value">{formatTime(eventData.eventTime || eventData.time)}</div>
                  </div>

                  <div className="tk-info-full">
                    <div className="tk-info-label">Location</div>
                    <div className="tk-info-value">{eventData.eventLoc || eventData.location || 'Location TBD'}</div>
                  </div>

                  <div>
                    <div className="tk-info-label">Max Participants</div>
                    <div className="tk-info-value">{eventData.maxPart || eventData.maxParticipants || 'No limit'}</div>
                  </div>
                  <div>
                    <div className="tk-info-label">Max Volunteers</div>
                    <div className="tk-info-value">{eventData.maxVoln || eventData.maxVolunteers || 'No limit'}</div>
                  </div>
              </div>

              {/* Description */}
              <div className="tk-details-text">
                "{eventData.eventdesc || eventData.description || 'No description available'}"
              </div>

            </div>

            {/* Divider Notches */}
            <div className="tk-notch-container">
              <div className="tk-notch tk-notch-left"></div>
              <div className="tk-notch tk-notch-right"></div>
            </div>

            {/* Bottom Stub - Compact Scanner */}
            <div className="tk-stub-content">
              <button 
                onClick={handleScanQR}
                className="tk-scan-btn"
                title="Scan Attendee QR"
              >
                <i className="fas fa-qrcode"></i>
                SCAN ATTENDEES
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
