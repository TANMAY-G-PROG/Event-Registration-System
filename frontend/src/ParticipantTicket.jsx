import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './ticket.css';

export default function ParticipantTicket() {
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  const fetchEventData = async (eventId) => {
    try {
      // Fetch event details with participant-specific payment status
      // Using relative path for Render deployment
      const response = await fetch(`/api/events/${eventId}/participant-status`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/');
          return;
        }
        throw new Error('Failed to fetch event data');
      }

      const data = await response.json();
      
      // Check if user is actually a participant
      if (!data.isRegistered) {
        setError("You are not registered as a participant for this event.");
        setLoading(false);
        return;
      }
      
      setEventData(data);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching event:', err);
      setError('Unable to load event details. Please try again.');
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigate('/participants');
  };

  // Determine payment status logic
  const isPaidEvent = eventData?.regFee > 0;
  const paymentStatus = eventData?.paymentStatus; // 'verified', 'pending_verification', or null
  const isPaymentVerified = paymentStatus === 'verified';
  const isPaymentPending = paymentStatus === 'pending_verification';
  const isPaymentRejected = paymentStatus === 'rejected';
  
  // Can only scan if: (1) Free event, OR (2) Paid event with verified payment
  const canScan = !isPaidEvent || (isPaidEvent && isPaymentVerified);

  const handleScanQR = () => {
    if (!canScan) {
      alert('Your payment must be verified by the organizer before you can mark attendance.');
      return;
    }
    navigate('/scanner?role=participant');
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

  // Status badge logic
  const getPaymentBadge = () => {
    if (!isPaidEvent) return null;
    
    if (isPaymentVerified) {
      return { text: 'PAYMENT VERIFIED', className: 'verified', icon: 'check-circle' };
    } else if (isPaymentPending) {
      return { text: 'PAYMENT PENDING', className: 'pending', icon: 'hourglass-half' };
    } else if (isPaymentRejected) {
      return { text: 'PAYMENT REJECTED', className: 'rejected', icon: 'times-circle' };
    } else {
      return { text: 'PAYMENT REQUIRED', className: 'required', icon: 'exclamation-circle' };
    }
  };

  const paymentBadge = getPaymentBadge();

  return (
    <div className="ticket-page-wrapper">
      
      {/* Navigation */}
      <div className="tk-nav-container">
        <button onClick={handleBack} className="tk-nav-btn">
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="tk-loading-container">
            <p>Loading your ticket...</p>
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
            
            {/* Grain/Noise Overlay */}
            <div className="tk-texture-overlay"></div>
            
            <div className="tk-top-notch"></div>

            <div className="tk-main-content">
              
              {/* Event Title */}
              <h1 className="tk-event-title">
                {eventData.ename || 'Untitled Event'}
              </h1>
              
              {/* Payment Status Badge (Stamp style) */}
              {paymentBadge && (
                 <div className={`tk-stamp-badge ${paymentBadge.className}`}>
                    <i className={`fas fa-${paymentBadge.icon}`}></i> {paymentBadge.text}
                 </div>
              )}

              <div className="tk-separator-dots"></div>

              {/* Data Grid */}
              <div className="tk-info-grid">
                  
                  {/* Row 1: Date & Time */}
                  <div>
                    <div className="tk-info-label">Date</div>
                    <div className="tk-info-value">{formatDate(eventData.eventDate)}</div>
                  </div>
                  <div>
                    <div className="tk-info-label">Time</div>
                    <div className="tk-info-value">{formatTime(eventData.eventTime)}</div>
                  </div>

                  {/* Row 2: Location (Full Width) */}
                  <div className="tk-info-full">
                    <div className="tk-info-label">Location</div>
                    <div className="tk-info-value">{eventData.eventLoc || 'Location TBD'}</div>
                  </div>

                  {/* Row 3: Participants & Volunteers */}
                  <div>
                    <div className="tk-info-label">Max Participants</div>
                    <div className="tk-info-value">{eventData.maxPart || 'No limit'}</div>
                  </div>
                  <div>
                    <div className="tk-info-label">Max Volunteers</div>
                    <div className="tk-info-value">{eventData.maxVoln || 'No limit'}</div>
                  </div>

                  {/* Row 4: Registration Fee */}
                  <div>
                    <div className="tk-info-label">Reg Fee</div>
                    <div className="tk-info-value">₹{eventData.regFee || '0'}</div>
                  </div>
              </div>

              {/* Club Name */}
              {eventData.clubName && (
                  <div className="tk-club-section">
                    <div className="tk-info-label">Organized By</div>
                    <div className="tk-club-value">{eventData.clubName}</div>
                  </div>
              )}

              {/* Description */}
              <div className="tk-details-text">
                "{eventData.eventdesc || 'No description available'}"
              </div>

            </div>

            {/* Divider Notches */}
            <div className="tk-notch-container">
              <div className="tk-notch tk-notch-left"></div>
              <div className="tk-notch tk-notch-right"></div>
            </div>

            {/* Bottom Stub - Contains Scanner Button */}
            <div className="tk-stub-content">
              
              <button 
                onClick={handleScanQR}
                className={`tk-scan-btn ${!canScan ? 'disabled' : ''}`}
                title={canScan ? "Open Scanner" : "Payment verification required"}
                disabled={!canScan}
              >
                <i className="fas fa-qrcode"></i>
                {canScan ? 'SCAN TICKET' : 'LOCKED'}
              </button>

              {/* Helper Message for Locked State */}
              {!canScan && (
                 <p className="tk-lock-msg">
                    {isPaymentPending ? "Payment Pending Verification" : "Payment Required"}
                 </p>
              )}

            </div>

          </div>
        </div>
      )}
    </div>
  );
}
