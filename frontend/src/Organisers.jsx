import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import './organisers.css';

const Organisers = () => {
  const navigate = useNavigate();

  const [events, setEvents] = useState({
    ongoing: [],
    completed: [],
    upcoming: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingExcel, setGeneratingExcel] = useState({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEventForPayments, setSelectedEventForPayments] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [processingPayment, setProcessingPayment] = useState({});
  const [isTeamEvent, setIsTeamEvent] = useState(false);

  // --- Logic Preserved ---
  const categorizeEvents = useCallback((events) => {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const categorized = {
      ongoing: [],
      completed: [],
      upcoming: [],
    };

    events.forEach((event) => {
      const eventDate = new Date(event.eventDate);
      eventDate.setHours(0, 0, 0, 0);
      const diffTime = eventDate.getTime() - currentDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        categorized.ongoing.push(event);
      } else if (diffDays < 0) {
        categorized.completed.push(event);
      } else {
        categorized.upcoming.push(event);
      }
    });

    return categorized;
  }, []);

  const fetchOrganizerEvents = async () => {
    try {
      const response = await fetch('/api/my-organized-events', {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const categorizedEvents = categorizeEvents(data.organizerEvents || []);
      setEvents(categorizedEvents);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching organizer events:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganizerEvents();
  }, [navigate, categorizeEvents]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const [hours, minutes] = timeString.split(':');
    let h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${minutes} ${ampm}`;
  };

  const handleGenerateDetails = async (eventId, eventName) => {
    try {
      setGeneratingExcel((prev) => ({ ...prev, [eventId]: true }));

      const response = await fetch(`/api/events/${eventId}/generate-details`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        if (response.status === 401) {
          alert('Session expired. Please login again.');
          navigate('/');
          return;
        }
        if (response.status === 403) {
          alert('You are not authorized to generate details for this event.');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Event_${eventName.replace(/\s+/g, '_')}_Details.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error generating Excel file:', err);
      alert('Error generating Excel file. Please try again.');
    } finally {
      setGeneratingExcel((prev) => ({ ...prev, [eventId]: false }));
    }
  };

  const handleViewPendingPayments = async (event) => {
    setSelectedEventForPayments(event);
    setShowPaymentModal(true);
    setLoadingPayments(true);

    try {
      const response = await fetch(`/api/events/${event.eid}/pending-payments`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Failed to fetch pending payments');

      const data = await response.json();
      setPendingPayments(data.pendingPayments || []);
      setIsTeamEvent(data.isTeamEvent || false);
    } catch (err) {
      console.error('Error fetching pending payments:', err);
      alert('Error loading pending payments');
      setPendingPayments([]);
      setIsTeamEvent(false);
    } finally {
      setLoadingPayments(false);
    }
  };

  const handleVerifyPayment = async (participantUSN, eventId) => {
    setProcessingPayment((prev) => ({ ...prev, [participantUSN]: 'verifying' }));

    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantUSN, eventId }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP status ${response.status}`);

      // Success Animation State
      setProcessingPayment((prev) => ({ ...prev, [participantUSN]: 'success' }));
      
      setTimeout(() => {
        if (data.verifiedCount && data.verifiedCount > 1) {
          alert(`${data.message}\nAll ${data.verifiedCount} team members can now mark attendance.`);
        }
        setPendingPayments((prev) => prev.filter((p) => p.partusn !== participantUSN));
        setProcessingPayment((prev) => ({ ...prev, [participantUSN]: null }));
      }, 1200);

    } catch (err) {
      console.error('Error verifying payment:', err);
      alert(`Error: ${err.message || 'Failed to verify payment. Please try again.'}`);
      setProcessingPayment((prev) => ({ ...prev, [participantUSN]: null }));
    } 
  };

  const handleEventButtonClick = (eventId) => {
    navigate(`/organiser-ticket?eventId=${eventId}`);
  };

  const handleOrganiseClick = () => navigate('/create-event');
  const handleBack = () => navigate('/events');

  // --- Render Event Item (Using Updated Buttons inside Cards) ---
  const renderEventsList = (eventsList, eventType) => {
    if (loading) return <div className="event-message">Loading events...</div>;
    if (error) return <div className="event-message error">Error: {error}</div>;
    if (!eventsList || eventsList.length === 0) return <div className="event-message">No {eventType} events found.</div>;

    return eventsList.map((event) => (
      <div className="event-item-glass" key={event.eid}>
        
        <div className="event-info">
          <h4>{DOMPurify.sanitize(event.ename || 'N/A')}</h4>
          <p className="description">{DOMPurify.sanitize(event.eventdesc || 'No description')}</p>
          
          <div className="meta-info">
            <span><i className="fas fa-calendar-alt"></i> {formatDate(event.eventDate)}</span>
            <span><i className="fas fa-clock"></i> {formatTime(event.eventTime)}</span>
            <span><i className="fas fa-map-marker-alt"></i> {DOMPurify.sanitize(event.eventLoc || 'N/A')}</span>
          </div>

          <div className="stats-info">
             <span><i className="fas fa-users"></i> {event.maxPart || '∞'} Seats</span>
             {event.regFee > 0 && <span className="fee-tag">₹{event.regFee}</span>}
          </div>
        </div>

        <div className="event-actions">
          {eventType !== 'completed' && (
            <button
              className="glass-btn secondary"
              onClick={() => handleEventButtonClick(event.eid)}
              title="View Event Page"
            >
              <i className="fas fa-eye"></i> View
            </button>
          )}

          {event.regFee > 0 && eventType !== 'completed' && (
            <button
              className="glass-btn primary pulse-border"
              onClick={() => handleViewPendingPayments(event)}
              title="Verify Payments"
            >
              <i className="fas fa-credit-card"></i> Verify
            </button>
          )}

          <button
            className="glass-btn tertiary"
            onClick={() => handleGenerateDetails(event.eid, event.ename)}
            disabled={generatingExcel[event.eid]}
            title="Download Excel"
          >
            {generatingExcel[event.eid] ? <span className="spinner-sm"></span> : <><i className="fas fa-file-excel"></i> Details</>}
          </button>
        </div>
      </div>
    ));
  };

  return (
    <div className="organisers-dashboard-wrapper">
      {/* Background Elements */}
      <div className="noise-overlay"></div>

      <div className="logout-container">
        <button className="back-nav-btn" onClick={handleBack}>
          <i className="fas fa-arrow-left"></i> Back
        </button>
      </div>

      <section className="hero-section">
        <div className="container">
          
          <div className="card-grid">
            
            <div className="pop-card" id="completed-card">
              <div className="card-header">
                 <h3>Completed Events</h3>
                 <span className="count-badge">{events.completed.length}</span>
              </div>
              <div className="card-body">
                 {renderEventsList(events.completed, 'completed')}
              </div>
            </div>

            <div className="pop-card" id="ongoing-card">
              <div className="card-header">
                 <h3>Ongoing Events</h3>
                 <div className="live-tag"><span className="blink"></span> LIVE</div>
              </div>
              <div className="card-body">
                 {renderEventsList(events.ongoing, 'ongoing')}
              </div>
            </div>

            <div className="pop-card" id="upcoming-card">
              <div className="card-header">
                 <h3>Upcoming Events</h3>
                 <span className="count-badge">{events.upcoming.length}</span>
              </div>
              <div className="card-body">
                 {renderEventsList(events.upcoming, 'upcoming')}
              </div>
            </div>

          </div>

          <div className="button-container">
            <button className="create-event-btn" onClick={handleOrganiseClick}>
              <span className="plus-icon">+</span> Organise New Event
            </button>
          </div>
        </div>
      </section>

      {/* Fintech Modal */}
      {showPaymentModal && (
        <div className="fintech-modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="fintech-modal" onClick={(e) => e.stopPropagation()}>
             <div className="modal-top-bar">
                <div className="modal-title-group">
                   <h2>Payment Verification</h2>
                   <span className="modal-subtitle">{selectedEventForPayments?.ename}</span>
                </div>
                <button className="modal-close-btn" onClick={() => setShowPaymentModal(false)}>×</button>
             </div>

             <div className="modal-content-area">
                {loadingPayments ? (
                  <div className="payment-loading-state">
                     <div className="spinner-dots"></div>
                     <p>Loading transactions...</p>
                  </div>
                ) : pendingPayments.length === 0 ? (
                  <div className="empty-payments">
                     <div className="check-ring-lg"><i className="fas fa-check"></i></div>
                     <h3>All Caught Up!</h3>
                     <p>No pending transactions found.</p>
                  </div>
                ) : (
                  <div className="payment-list">
                    {isTeamEvent && (
                       <div className="notice-banner">
                          <i className="fas fa-users"></i>
                          <span><strong>Team Event:</strong> Verifying Leader approves everyone.</span>
                       </div>
                    )}
                    
                    {pendingPayments.map((payment, index) => (
                      <div className="payment-row-card" key={index} style={{animationDelay: `${index * 0.05}s`}}>
                         <div className="pay-user-info">
                            <div className="avatar-placeholder">
                               {payment.studentName.charAt(0)}
                            </div>
                            <div className="text-details">
                               <h5>{DOMPurify.sanitize(payment.studentName)} {payment.isTeamLeader && <span className="tag-leader">LEADER</span>}</h5>
                               <span className="usn">{payment.partusn}</span>
                            </div>
                         </div>
                         
                         <div className="pay-meta">
                            <span className="pay-id">ID: {payment.transactionId}</span>
                            <span className="pay-amount">₹{payment.amount}</span>
                         </div>

                         <div className="pay-action">
                           {processingPayment[payment.partusn] === 'success' ? (
                              <div className="success-tick-anim">
                                 <i className="fas fa-check-circle"></i>
                              </div>
                           ) : (
                              <button 
                                className={`verify-btn ${processingPayment[payment.partusn] ? 'loading' : ''}`}
                                onClick={() => handleVerifyPayment(payment.partusn, selectedEventForPayments.eid)}
                                disabled={!!processingPayment[payment.partusn]}
                              >
                                 {processingPayment[payment.partusn] === 'verifying' ? <div className="spinner-dots-sm"></div> : 'Approve'}
                              </button>
                           )}
                         </div>
                      </div>
                    ))}
                  </div>
                )}
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Organisers;
