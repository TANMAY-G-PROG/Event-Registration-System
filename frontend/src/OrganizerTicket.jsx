import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './ticket.css';
import { apiFetch } from './api.js';

export default function OrganizerTicket() {
  const [eventData, setEventData]         = useState(null);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [userUSN, setUserUSN]             = useState(null);
  const [subEvents, setSubEvents]         = useState([]);
  const [subEventsLoaded, setSubEventsLoaded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const eventId = urlParams.get('eventId');
    if (!eventId) { setError('No event ID provided in the URL'); setLoading(false); return; }
    fetchAllData(eventId);
  }, []);

  const fetchAllData = async (eventId) => {
    try {
      const [userRes, eventRes] = await Promise.all([
        apiFetch('/api/me',                 { method: 'GET', headers: { 'Content-Type': 'application/json' } }),
        apiFetch(`/api/events/${eventId}`,  { method: 'GET', headers: { 'Content-Type': 'application/json' } }),
      ]);
      if (!userRes.ok)  throw new Error(`HTTP ${userRes.status}: Failed to fetch user data`);
      if (!eventRes.ok) throw new Error(`HTTP ${eventRes.status}: ${eventRes.statusText}`);
      const [userData, evtData] = await Promise.all([userRes.json(), eventRes.json()]);
      const usn = userData.userUSN;
      if (!usn)             { setError('User not authenticated. Please sign in.'); setLoading(false); return; }
      setUserUSN(usn);
      if (!evtData.eid)     throw new Error('Invalid event data');
      if (evtData.OrgUsn !== usn) { setError('You are not the organizer of this event.'); setLoading(false); return; }
      setEventData(evtData);
      setLoading(false);
      // Non-blocking sub-events
      try {
        const subRes = await apiFetch(`/api/events/${eventId}/sub-events`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        if (subRes.ok) { const sub = await subRes.json(); setSubEvents(sub.subEvents || []); }
        else { setSubEvents([]); }
      } catch { setSubEvents([]); } finally { setSubEventsLoaded(true); }
    } catch (err) {
      setError(`Could not load event details. ${err.message}`);
      setLoading(false); setSubEventsLoaded(true);
    }
  };

  const handleQROrManage = () => {
    if (subEventsLoaded && subEvents.length === 1) navigate(`/qr?seid=${subEvents[0].seid}`);
    else navigate(`/sub-events?eventId=${eventData.eid}`);
  };

  const getButtonLabel = () => {
    if (!subEventsLoaded) return 'Loading...';
    return subEvents.length === 1 ? 'Show QR Code' : 'Manage Sub-events';
  };

  const getSubtitleLabel = () => {
    if (!subEventsLoaded) return '...';
    return subEvents.length === 1 ? `Sub-event: ${subEvents[0].se_name}` : 'For Attendance Scanning';
  };

  const formatDate = (d) => {
    if (!d) return 'Not specified';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };
  const formatTime = (t) => {
    if (!t) return 'Not specified';
    const [h, m] = t.split(':'); let hr = parseInt(h);
    const ap = hr >= 12 ? 'PM' : 'AM'; hr = hr % 12 || 12;
    return `${hr}:${m} ${ap}`;
  };

  return (
    <div className="ticket-page-wrapper">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />

      {/* NAV */}
      <div className="tk-nav-container">
        <button onClick={() => window.location.href = '/organisers'} className="tk-nav-btn">
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      {loading && (
        <div className="tk-loading-container">
          <div className="tk-spinner"></div>
          <p>Loading Ticket...</p>
        </div>
      )}
      {error && (
        <div className="tk-error-container">
          <h3>Error</h3>
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && eventData && (
        <div className="tk-ticket-container">
          <div className="tk-ticket-card">

            {/* MAIN BODY */}
            <div className="tk-main-content">

              {/* Black header zone */}
              <div style={{
                background: 'var(--black)', padding: '18px 20px 14px',
                borderBottom: 'var(--border)', position: 'relative', overflow: 'hidden'
              }}>
                {/* Memphis triangle */}
                <div style={{
                  position: 'absolute', right: 16, bottom: 0,
                  width: 0, height: 0,
                  borderLeft: '24px solid transparent',
                  borderBottom: '24px solid rgba(255,214,0,0.18)',
                  borderRight: '24px solid transparent',
                }} />
                <h1 className="tk-event-title" style={{ margin: 0, color: 'var(--yellow)' }}>
                  {eventData.ename || 'Untitled Event'}
                </h1>
              </div>

              {/* Organiser badge */}
              <div style={{ padding: '10px 20px 10px', borderBottom: '2px solid var(--black)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-block', padding: '3px 10px',
                  fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  background: 'var(--yellow)', color: 'var(--black)', border: '2px solid var(--black)'
                }}>
                  <i className="fas fa-star" style={{ marginRight: 5 }}></i>
                  Organiser: {userUSN}
                </span>
                {eventData.clubName && (
                  <span className="tk-club-name" style={{ margin: 0 }}>{eventData.clubName}</span>
                )}
              </div>

              {/* Info grid */}
              <div className="tk-info-grid">
                <div>
                  <span className="tk-info-label">Date</span>
                  <span className="tk-info-value">{formatDate(eventData.eventDate)}</span>
                </div>
                <div>
                  <span className="tk-info-label">Time</span>
                  <span className="tk-info-value">{formatTime(eventData.eventTime)}</span>
                </div>
                <div style={{ gridColumn: '1/-1', borderRight: 'none' }}>
                  <span className="tk-info-label">Location</span>
                  <span className="tk-info-value">{eventData.eventLoc || 'TBD'}</span>
                </div>
                <div>
                  <span className="tk-info-label">Capacity</span>
                  <span className="tk-info-value">{eventData.maxPart}</span>
                </div>
                <div>
                  <span className="tk-info-label">Max Volunteers</span>
                  <span className="tk-info-value">{eventData.maxVoln}</span>
                </div>
                <div>
                  <span className="tk-info-label">Event ID</span>
                  <span className="tk-info-value" style={{ fontSize: 11 }}>{eventData.eid}</span>
                </div>
                <div>
                  <span className="tk-info-label">Sub-events</span>
                  <span className="tk-info-value">{subEventsLoaded ? subEvents.length : '...'}</span>
                </div>
              </div>

              {/* Description */}
              <p className="tk-details-text">
                "{eventData.eventdesc || 'No description provided.'}"
              </p>
            </div>

            {/* PERFORATED DIVIDER */}
            <div className="tk-notch-container">
              <div className="tk-notch tk-notch-left"></div>
              <div className="tk-notch tk-notch-right"></div>
            </div>

            {/* STUB */}
            <div className="tk-stub-content">
              <button
                onClick={handleQROrManage}
                className="tk-scan-btn tk-org-btn"
                disabled={!subEventsLoaded}
                style={{ opacity: subEventsLoaded ? 1 : 0.6 }}
              >
                <i className="fas fa-qrcode"></i>
                {getButtonLabel()}
              </button>
              <p className="tk-lock-msg">{getSubtitleLabel()}</p>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}