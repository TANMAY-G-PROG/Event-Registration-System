import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ticket.css';

export default function OrganizerTicket() {
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userUSN, setUserUSN] = useState(null);
  const [subEvents, setSubEvents] = useState([]);
  const [subEventsLoaded, setSubEventsLoaded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');

    if (!eventId) {
      setError('No event ID provided in the URL');
      setLoading(false);
      return;
    }

    fetchAllData(eventId);
  }, []);

  const fetchAllData = async (eventId) => {
    try {
      // Fetch user + event in parallel
      const [userRes, eventRes] = await Promise.all([
        fetch('/api/me', { method: 'GET', credentials: 'include', headers: { 'Content-Type': 'application/json' } }),
        fetch(`/api/events/${eventId}`, { method: 'GET', credentials: 'include', headers: { 'Content-Type': 'application/json' } }),
      ]);

      if (!userRes.ok) throw new Error(`HTTP ${userRes.status}: Failed to fetch user data`);
      if (!eventRes.ok) throw new Error(`HTTP ${eventRes.status}: ${eventRes.statusText}`);

      const [userData, evtData] = await Promise.all([userRes.json(), eventRes.json()]);

      const usn = userData.userUSN;
      if (!usn) {
        setError('User not authenticated. Please sign in.');
        setLoading(false);
        return;
      }
      setUserUSN(usn);

      if (!evtData.eid) throw new Error('Invalid event data');
      if (evtData.OrgUsn !== usn) {
        setError('You are not the organizer of this event.');
        setLoading(false);
        return;
      }

      setEventData(evtData);
      setLoading(false); // render ticket immediately, button updates after sub-events arrive

      // Fetch sub-events separately (non-blocking)
      try {
        const subRes = await fetch(`/api/events/${eventId}/sub-events`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        console.log('[OrganizerTicket] sub-events status:', subRes.status);

        if (subRes.ok) {
          const subData = await subRes.json();
          console.log('[OrganizerTicket] sub-events data:', JSON.stringify(subData));
          setSubEvents(subData.subEvents || []);
        } else {
          console.warn('[OrganizerTicket] sub-events fetch failed:', subRes.status);
          setSubEvents([]);
        }
      } catch (subErr) {
        console.warn('[OrganizerTicket] sub-events fetch error:', subErr);
        setSubEvents([]);
      } finally {
        setSubEventsLoaded(true);
      }

    } catch (err) {
      console.error('Error fetching data:', err);
      setError(`Could not load event details. ${err.message}`);
      setLoading(false);
      setSubEventsLoaded(true);
    }
  };

  const handleBack = () => {
    window.location.href = '/organisers';
  };

  const handleQROrManage = () => {
    if (subEventsLoaded && subEvents.length === 1) {
      navigate(`/qr?seid=${subEvents[0].seid}`);
    } else {
      navigate(`/sub-events?eventId=${eventData.eid}`);
    }
  };

  const getButtonLabel = () => {
    if (!subEventsLoaded) return 'Loading...';
    if (subEvents.length === 1) return 'Show QR Code';
    return 'Manage Sub-events';
  };

  const getSubtitleLabel = () => {
    if (!subEventsLoaded) return '...';
    if (subEvents.length === 1) return `Sub-event: ${subEvents[0].se_name}`;
    return 'For Attendance Scanning';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'Not specified';
    const [h, m] = timeString.split(':');
    let hours = parseInt(h);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${m} ${ampm}`;
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
            <div className="tk-texture-overlay"></div>
            <div className="tk-top-notch"></div>

            <div className="tk-main-content">
              <div className="tk-club-name">{eventData.clubName || 'Event Organizer'}</div>
              <h1 className="tk-event-title">{eventData.ename || 'Untitled Event'}</h1>
              <div className="tk-separator-dots"></div>

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

              <p className="tk-details-text">
                {eventData.eventdesc || 'No description provided.'}
              </p>
            </div>

            <div className="tk-notch-container">
              <div className="tk-notch tk-notch-left"></div>
              <div className="tk-notch tk-notch-right"></div>
            </div>

            <div className="tk-stub-content">
              <button
                onClick={handleQROrManage}
                className="tk-scan-btn tk-org-btn"
                disabled={!subEventsLoaded}
                style={{ opacity: subEventsLoaded ? 1 : 0.6 }}
              >
                <i className={`fas ${subEventsLoaded && subEvents.length === 1 ? 'fa-qrcode' : 'fa-qrcode'}`}></i>
                {getButtonLabel()}
              </button>
              <div className="tk-lock-msg" style={{color: '#666', fontWeight: '500'}}>
                {getSubtitleLabel()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
