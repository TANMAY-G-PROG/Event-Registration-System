import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom'; // Use useSearchParams
import './ticket.css'; // Changed to ticket.css as per your other files

// ⛔️ REMOVED: const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function ParticipantTicket() {
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams(); // Use searchParams hook

  useEffect(() => {
    const eventId = searchParams.get('eventId'); // Get eventId from URL

    if (!eventId) {
      setError('No event ID provided in the URL');
      setLoading(false);
      return;
    }

    fetchEventData(eventId);
  }, [searchParams]); // Rerun if searchParams change

  const fetchEventData = async (eventId) => {
    try {
      // ✅ CHANGED: Fetched from the correct endpoint to get payment status
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/'); // Redirect if not logged in
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
    navigate('/participants'); // Use navigate
  };

  const handleScanQR = () => {
    // Pass the participant role to the scanner
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

  // ⭐️ NEW: Determine payment status and message
  const isPaidEvent = eventData?.regFee > 0;
  const isPaymentPending = eventData?.paymentStatus === 'pending_verification';
  const canScan = !isPaidEvent || (isPaidEvent && !isPaymentPending);

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
              <p className="tk-event-id">Event ID: {eventData.eid}</p>
              {/* ⭐️ NEW: Show payment status badge */}
              {isPaidEvent && (
                <p className={`tk-user-badge ${isPaymentPending ? 'pending' : 'verified'}`}>
                  {isPaymentPending ? '💳 Payment Pending Verification' : '✅ Payment Verified'}
                </p>
              )}
            </div>

            <div className="tk-ticket-content">
              {/* ... (all your tk-info-section divs remain the same) ... */}
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
              {/* ⭐️ NEW: Added disabled logic to the button */}
              <button
                onClick={handleScanQR}
                className="tk-qr-placeholder tk-qr-scanner"
                title={canScan ? "Open QR Scanner" : "Payment must be verified to mark attendance"}
                disabled={!canScan} 
              >
                📱
                <div className="tk-qr-text">MARK ATTENDANCE</div>
              </button>
              {/* ⭐️ NEW: Show a message when button is disabled */}
              {!canScan && (
                 <p className="tk-payment-pending-message">
                   Your payment is pending verification. Attendance can be marked once the organizer approves your payment.
                 </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
