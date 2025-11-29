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

  const handleScanQR = () => {
    // Only allow scanning if payment is verified (or event is free)
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

  // Determine payment status
  const isPaidEvent = eventData?.regFee > 0;
  const paymentStatus = eventData?.paymentStatus; // 'verified', 'pending_verification', or null
  const isPaymentVerified = paymentStatus === 'verified';
  const isPaymentPending = paymentStatus === 'pending_verification';
  const isPaymentRejected = paymentStatus === 'rejected';
  
  // Can only scan if: (1) Free event, OR (2) Paid event with verified payment
  const canScan = !isPaidEvent || (isPaidEvent && isPaymentVerified);

  // Status badge text and class
  const getPaymentBadge = () => {
    if (!isPaidEvent) return null;
    
    if (isPaymentVerified) {
      return { text: '✅ Payment Verified', className: 'verified' };
    } else if (isPaymentPending) {
      return { text: '⏳ Payment Pending Verification', className: 'pending' };
    } else if (isPaymentRejected) {
      return { text: '❌ Payment Rejected', className: 'rejected' };
    } else {
      return { text: '⚠️ Payment Required', className: 'required' };
    }
  };

  const paymentBadge = getPaymentBadge();

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
                {eventData.ename || 'Untitled Event'}
              </h1>
              
              {/* Payment Status Badge */}
              {paymentBadge && (
                <p className={`tk-user-badge ${paymentBadge.className}`}>
                  {paymentBadge.text}
                </p>
              )}
            </div>

            <div className="tk-ticket-content">
              <div className="tk-info-section">
                <div className="tk-info-icon">📅</div>
                <div className="tk-info-content">
                  <h3>Date</h3>
                  <p>{formatDate(eventData.eventDate)}</p>
                </div>
              </div>

              <div className="tk-info-section">
                <div className="tk-info-icon">⏰</div>
                <div className="tk-info-content">
                  <h3>Time</h3>
                  <p>{formatTime(eventData.eventTime)}</p>
                </div>
              </div>

              <div className="tk-info-section">
                <div className="tk-info-icon">📍</div>
                <div className="tk-info-content">
                  <h3>Location</h3>
                  <p>{eventData.eventLoc || 'Location TBD'}</p>
                </div>
              </div>

              <div className="tk-info-section">
                <div className="tk-info-icon">👥</div>
                <div className="tk-info-content">
                  <h3>Max Participants</h3>
                  <p>{eventData.maxPart || 'No limit'}</p>
                </div>
              </div>

              <div className="tk-info-section">
                <div className="tk-info-icon">🤝</div>
                <div className="tk-info-content">
                  <h3>Max Volunteers</h3>
                  <p>{eventData.maxVoln || 'No limit'}</p>
                </div>
              </div>

              <div className="tk-info-section">
                <div className="tk-info-icon">💰</div>
                <div className="tk-info-content">
                  <h3>Registration Fee</h3>
                  <p>₹{eventData.regFee || '0'}</p>
                </div>
              </div>

              {eventData.clubName && (
                <div className="tk-info-section">
                  <div className="tk-info-icon">🏛️</div>
                  <div className="tk-info-content">
                    <h3>Organized by</h3>
                    <p>{eventData.clubName}</p>
                  </div>
                </div>
              )}

              <div className="tk-description-section">
                <h3>Event Description</h3>
                <p>{eventData.eventdesc || 'No description available'}</p>
              </div>
            </div>

            <div className="tk-ticket-footer">
              <button
                onClick={handleScanQR}
                className={`tk-qr-placeholder tk-qr-scanner ${!canScan ? 'disabled' : ''}`}
                title={canScan ? "Open QR Scanner" : "Payment must be verified to mark attendance"}
                disabled={!canScan}
              >
                📱
                <div className="tk-qr-text">
                  {canScan ? 'MARK ATTENDANCE' : 'ATTENDANCE LOCKED'}
                </div>
              </button>
              
              {/* Show appropriate message based on payment status */}
              {!canScan && (
                <div className="tk-payment-message">
                  {isPaymentPending && (
                    <p className="tk-payment-pending-message">
                      ⏳ Your payment is pending verification. Attendance can be marked once the organizer approves your payment.
                    </p>
                  )}
                  {isPaymentRejected && (
                    <p className="tk-payment-rejected-message">
                      ❌ Your payment was rejected. Please contact the organizer or re-register for this event.
                    </p>
                  )}
                  {!paymentStatus && isPaidEvent && (
                    <p className="tk-payment-required-message">
                      ⚠️ Payment required. Please complete your payment to mark attendance.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

