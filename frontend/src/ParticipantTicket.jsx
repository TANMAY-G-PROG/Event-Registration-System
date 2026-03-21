import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './ticket.css';
import { apiFetch } from './api.js';

export default function ParticipantTicket() {
  const [eventData, setEventData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const eventId = searchParams.get('eventId');
    if (!eventId) { setError('No event ID provided'); setLoading(false); return; }
    const fetchData = async () => {
      await Promise.all([fetchEventData(eventId), fetchUserData()]);
      setLoading(false);
    };
    fetchData();
  }, [searchParams]);

  const fetchUserData = async () => {
    try {
      const res = await apiFetch('/api/me', { method: 'GET', headers: { 'Content-Type': 'application/json' } });
      if (res.ok) setUserData(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchEventData = async (eventId) => {
    try {
      const res = await apiFetch(`/api/events/${eventId}/participant-status`, {
        method: 'GET', headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) { if (res.status === 401) { navigate('/'); return; } throw new Error('Failed'); }
      const data = await res.json();
      if (!data.isRegistered) { setError('You are not registered as a participant for this event.'); return; }
      setEventData(data);
    } catch (err) { setError('Unable to load event details. Please try again.'); }
  };

  const formatDate = (d) => {
    if (!d) return 'TBD';
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };
  const formatTime = (t) => {
    if (!t) return 'TBD';
    const [h, m] = t.split(':'); let hr = parseInt(h);
    const ap = hr >= 12 ? 'PM' : 'AM'; hr = hr % 12 || 12;
    return `${hr}:${m} ${ap}`;
  };

  const isPaidEvent = eventData?.regFee > 0;
  const paymentStatus = eventData?.paymentStatus;
  const isPaymentVerified = paymentStatus === 'verified';
  const isPaymentPending = paymentStatus === 'pending_verification';
  const isPaymentRejected = paymentStatus === 'rejected';
  const canScan = !isPaidEvent || (isPaidEvent && isPaymentVerified);

  const handleScanQR = () => {
    if (!canScan) { alert('Your payment must be verified by the organizer before you can mark attendance.'); return; }
    navigate('/scanner?role=participant');
  };

  const getPaymentBadge = () => {
    if (!isPaidEvent) return null;
    if (isPaymentVerified) return { text: 'PAYMENT VERIFIED', cls: 'verified', icon: 'check-circle' };
    if (isPaymentPending) return { text: 'PAYMENT PENDING', cls: 'pending', icon: 'hourglass-half' };
    if (isPaymentRejected) return { text: 'PAYMENT REJECTED', cls: 'rejected', icon: 'times-circle' };
    return { text: 'PAYMENT REQUIRED', cls: 'required', icon: 'exclamation-circle' };
  };
  const badge = getPaymentBadge();

  return (
    <div className="ticket-page-wrapper">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css" />

      {/* NAV */}
      <div className="tk-nav-container">
        <button onClick={() => navigate('/participants')} className="tk-nav-btn">
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      {/* STATES */}
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

      {/* TICKET */}
      {!loading && !error && eventData && (
        <div className="tk-ticket-container">
          <div className="tk-ticket-card">

            {/* ── MAIN BODY ── */}
            <div className="tk-main-content">

              {/* Memphis stripe rendered via CSS ::before */}

              {/* Hero zone with Memphis decoration */}
              <div className="tk-hero-zone">
                <h1 className="tk-event-title">
                  {eventData.ename || 'Untitled Event'}
                </h1>
                <div className="tk-badge-row">
                  <span className="tk-role-badge participant">
                    <i className="fas fa-user"></i>
                    {userData?.userUSN ? `Participant · ${userData.userUSN}` : 'Participant'}
                  </span>
                  {eventData.clubName && (
                    <span className="tk-club-badge">{eventData.clubName}</span>
                  )}
                </div>
              </div>

              {/* Payment stripe */}
              {badge && (
                <div className={`tk-payment-stripe ${badge.cls}`}>
                  <i className={`fas fa-${badge.icon}`}></i> {badge.text}
                </div>
              )}

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
                <div className="tk-info-full" style={{ gridColumn: '1/-1', borderRight: 'none' }}>
                  <span className="tk-info-label">Location</span>
                  <span className="tk-info-value">{eventData.eventLoc || 'TBD'}</span>
                </div>
                <div>
                  <span className="tk-info-label">Max Participants</span>
                  <span className="tk-info-value">{eventData.maxPart || 'No limit'}</span>
                </div>
                <div>
                  <span className="tk-info-label">Reg Fee</span>
                  <span className="tk-info-value">
                    {eventData.regFee > 0 ? `₹${eventData.regFee}` : 'Free'}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="tk-details-text">
                "{eventData.eventdesc || 'No description available'}"
              </p>
            </div>

            {/* ── PERFORATED DIVIDER ── */}
            <div className="tk-notch-container">
              <div className="tk-notch tk-notch-left"></div>
              <div className="tk-notch tk-notch-right"></div>
            </div>

            {/* ── STUB ── */}
            <div className="tk-stub-content">
              <div className="tk-serial-bar">
                <span className="tk-serial-text">
                  FLO-{String(eventData.eid || '').slice(-4).toUpperCase()}-{(userData?.userUSN || '').slice(-4).toUpperCase()}
                </span>
                <span className="tk-serial-text">ADMIT ONE</span>
              </div>
              <button
                onClick={handleScanQR}
                className={`tk-scan-btn ${!canScan ? 'disabled' : ''}`}
                disabled={!canScan}
              >
                <i className="fas fa-qrcode" style={{ fontSize: 18 }}></i>
                {canScan ? 'Scan to Mark Attendance' : 'Locked — Verify Payment'}
              </button>
              {!canScan && (
                <p className="tk-lock-msg">
                  {isPaymentPending ? '⏳ Awaiting organizer approval' : '💳 Complete payment to unlock'}
                </p>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}