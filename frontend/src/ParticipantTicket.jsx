import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import './ticket.css';

import { apiFetch } from './api.js';

export default function ParticipantTicket() {
  const [eventData, setEventData] = useState(null);
  const [userData, setUserData] = useState(null); // State for User Data (USN)
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

    // Fetch both Event Data and User Data
    const fetchData = async () => {
        await Promise.all([fetchEventData(eventId), fetchUserData()]);
        setLoading(false);
    };

    fetchData();
  }, [searchParams]);

  // Fetch User Data (USN)
  const fetchUserData = async () => {
    try {
      const response = await apiFetch('/api/me', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        setUserData(data);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const fetchEventData = async (eventId) => {
    try {
      const response = await apiFetch(`/api/events/${eventId}/participant-status`, {
        method: 'GET',
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
      
      if (!data.isRegistered) {
        setError("You are not registered as a participant for this event.");
        return;
      }
      
      setEventData(data);
    } catch (err) {
      console.error('Error fetching event:', err);
      setError('Unable to load event details. Please try again.');
    }
  };

  const handleBack = () => {
    navigate('/participants');
  };

  const isPaidEvent = eventData?.regFee > 0;
  const paymentStatus = eventData?.paymentStatus;
  const isPaymentVerified = paymentStatus === 'verified';
  const isPaymentPending = paymentStatus === 'pending_verification';
  const isPaymentRejected = paymentStatus === 'rejected';
  
  const canScan = !isPaidEvent || (isPaidEvent && isPaymentVerified);

  const handleScanQR = () => {
    if (!canScan) {
      alert('Your payment must be verified by the organizer before you can mark attendance.');
      return;
    }
    navigate('/scanner?role=participant');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'TBD';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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
      
      {/* Glassy Back Button */}
      <div className="tk-nav-container">
        <button onClick={handleBack} className="tk-nav-btn">
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      {loading && <div className="tk-loading-container"><p>Loading Ticket...</p></div>}
      {error && <div className="tk-error-container"><h3>Error</h3><p>{error}</p></div>}

      {!loading && !error && eventData && (
        <div className="tk-ticket-container">
          <div className="tk-ticket-card">
            
            <div className="tk-texture-overlay"></div>
            <div className="tk-top-notch"></div>

            <div className="tk-main-content">
              
              {/* Event Title */}
              <h1 className="tk-event-title">
                {eventData.ename || 'Untitled Event'}
              </h1>

              {/* CLUB NAME (Yellow Font) */}
              {eventData.clubName && (
                 <div className="tk-club-name">
                    {eventData.clubName}
                 </div>
              )}

              {/* USN Badge (Added Here) */}
              {userData?.userUSN && (
                 <div className="tk-volunteer-badge">
                    Participant: {userData.userUSN}
                 </div>
              )}
              
              {/* Payment Status Badge */}
              {paymentBadge && (
                 <div className={`tk-stamp-badge ${paymentBadge.className}`}>
                    <i className={`fas fa-${paymentBadge.icon}`}></i> {paymentBadge.text}
                 </div>
              )}

              <div className="tk-separator-dots"></div>

              {/* Info Grid */}
              <div className="tk-info-grid">
                  <div>
                    <div className="tk-info-label">Date</div>
                    <div className="tk-info-value">{formatDate(eventData.eventDate)}</div>
                  </div>
                  <div>
                    <div className="tk-info-label">Time</div>
                    <div className="tk-info-value">{formatTime(eventData.eventTime)}</div>
                  </div>

                  <div className="tk-info-full">
                    <div className="tk-info-label">Location</div>
                    <div className="tk-info-value">{eventData.eventLoc || 'Location TBD'}</div>
                  </div>

                  <div>
                    <div className="tk-info-label">Participants</div>
                    <div className="tk-info-value">{eventData.maxPart || 'No limit'}</div>
                  </div>
                  <div>
                    <div className="tk-info-label">Reg Fee</div>
                    <div className="tk-info-value">₹{eventData.regFee || '0'}</div>
                  </div>
              </div>

              {/* Description */}
              <div className="tk-details-text">
                "{eventData.eventdesc || 'No description available'}"
              </div>

            </div>

            <div className="tk-notch-container">
              <div className="tk-notch tk-notch-left"></div>
              <div className="tk-notch tk-notch-right"></div>
            </div>

            <div className="tk-stub-content">
              <button 
                onClick={handleScanQR}
                className={`tk-scan-btn ${!canScan ? 'disabled' : ''}`}
                title={canScan ? "Open Scanner" : "Payment verification required"}
                disabled={!canScan}
              >
                <i className="fas fa-qrcode"></i>
                {canScan ? 'MARK ATTENDANCE' : 'LOCKED'}
              </button>

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
