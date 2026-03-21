import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './ticket.css';
import { apiFetch } from './api.js';

export default function VolunteerTicket() {
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [userUSN, setUserUSN]     = useState(null);
  const navigate                  = useNavigate();
  const [searchParams]            = useSearchParams();

  useEffect(() => {
    const eventId = searchParams.get('eventId');
    if (!eventId) { setError('No event ID provided'); setLoading(false); return; }
    fetchEventData(eventId);
  }, [searchParams]);

  const fetchUserData = async () => {
    try {
      const res = await apiFetch('/api/me');
      if (!res.ok) throw new Error('Failed to fetch user data');
      const data = await res.json();
      return data.userUSN;
    } catch { return null; }
  };

  const fetchEventData = async (eventId) => {
    try {
      const usn = await fetchUserData();
      if (!usn) { setError('User not authenticated. Please sign in.'); setLoading(false); return; }
      setUserUSN(usn);

      const res = await apiFetch('/api/my-volunteer-events');
      if (!res.ok) { if (res.status === 401) navigate('/'); throw new Error('Failed to fetch volunteer events'); }

      const data = await res.json();
      let found = null;

      if (data.volunteerEvents && Array.isArray(data.volunteerEvents)) {
        found = data.volunteerEvents.find(e => e.eid == eventId || e.id == eventId);
      } else if (data.volunteerEvents && typeof data.volunteerEvents === 'object') {
        for (const cat of ['ongoing', 'completed', 'upcoming']) {
          if (Array.isArray(data.volunteerEvents[cat])) {
            found = data.volunteerEvents[cat].find(e => e.eid == eventId || e.id == eventId);
            if (found) break;
          }
        }
      }

      if (found) { setEventData(found); }
      else { setError(`Event not found or you are not a volunteer for it.`); }
    } catch (err) {
      setError('Unable to load event details. Please try again.');
    } finally { setLoading(false); }
  };

  const formatDate = (d) => {
    if (!d) return 'TBD';
    const date = new Date(d);
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  };
  const formatTime = (t) => {
    if (!t) return 'TBD';
    const [h, m] = t.split(':'); let hr = parseInt(h);
    const ap = hr >= 12 ? 'PM' : 'AM'; hr = hr % 12 || 12;
    return `${hr}:${m} ${ap}`;
  };

  /* Shared stub content rendered in both in-card and fixed positions */
  const StubContent = () => (
    <>
      <button
        onClick={() => navigate('/scanner?role=volunteer')}
        className="tk-scan-btn"
        style={{ background: 'var(--pink)', borderColor: 'var(--pink)', boxShadow: '3px 3px 0 var(--pink)' }}
      >
        <i className="fas fa-qrcode"></i>
        SCAN ATTENDEES
      </button>
      <p className="tk-lock-msg">Tap to open the QR scanner</p>
    </>
  );

  return (
    <div className="ticket-page-wrapper">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />

      {/* NAV */}
      <div className="tk-nav-container">
        <button onClick={() => navigate('/volunteers')} className="tk-nav-btn">
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
                {/* Memphis dot cluster */}
                <div style={{
                  position: 'absolute', right: 12, top: 8,
                  width: 48, height: 48,
                  backgroundImage: 'radial-gradient(circle, rgba(255,45,138,0.4) 2px, transparent 2px)',
                  backgroundSize: '8px 8px',
                }} />
                <h1 className="tk-event-title" style={{ margin: 0, color: 'var(--yellow)' }}>
                  {eventData.ename || eventData.name || 'Untitled Event'}
                </h1>
              </div>

              {/* Badges */}
              <div style={{ padding: '10px 20px 10px', borderBottom: '2px solid var(--black)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-block', padding: '3px 10px',
                  fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  background: 'var(--pink)', color: '#fff', border: '2px solid var(--black)'
                }}>
                  <i className="fas fa-hand-holding-heart" style={{ marginRight: 5 }}></i>
                  Volunteer: {userUSN}
                </span>
                {(eventData.clubName || eventData.club) && (
                  <span className="tk-club-name" style={{ margin: 0 }}>
                    {eventData.clubName || eventData.club}
                  </span>
                )}
              </div>

              {/* Info grid */}
              <div className="tk-info-grid">
                <div>
                  <span className="tk-info-label">Date</span>
                  <span className="tk-info-value">{formatDate(eventData.eventDate || eventData.date)}</span>
                </div>
                <div>
                  <span className="tk-info-label">Time</span>
                  <span className="tk-info-value">{formatTime(eventData.eventTime || eventData.time)}</span>
                </div>
                <div style={{ gridColumn: '1/-1', borderRight: 'none' }}>
                  <span className="tk-info-label">Location</span>
                  <span className="tk-info-value">{eventData.eventLoc || eventData.location || 'TBD'}</span>
                </div>
                <div>
                  <span className="tk-info-label">Max Participants</span>
                  <span className="tk-info-value">{eventData.maxPart || eventData.maxParticipants || 'No limit'}</span>
                </div>
                <div>
                  <span className="tk-info-label">Max Volunteers</span>
                  <span className="tk-info-value">{eventData.maxVoln || eventData.maxVolunteers || 'No limit'}</span>
                </div>
              </div>

              {/* Description */}
              <p className="tk-details-text">
                "{eventData.eventdesc || eventData.description || 'No description available'}"
              </p>
            </div>

            {/* PERFORATED DIVIDER (hidden on mobile via CSS) */}
            <div className="tk-notch-container">
              <div className="tk-notch tk-notch-left"></div>
              <div className="tk-notch tk-notch-right"></div>
            </div>

            {/* STUB (desktop only — hidden on mobile via CSS) */}
            <div className="tk-stub-content" style={{
              backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(255,45,138,0.08) 6px, rgba(255,45,138,0.08) 12px)',
              backgroundColor: 'var(--black)',
            }}>
              <StubContent />
            </div>

          </div>
        </div>
      )}

      {/* ── FIXED STUB (mobile only) ── */}
      {!loading && !error && eventData && (
        <div className="tk-stub-fixed">
          <StubContent />
        </div>
      )}
    </div>
  );
}