import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './organisers.css';

const Organisers = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState({
    ongoing: [],
    completed: [],
    upcoming: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingExcel, setGeneratingExcel] = useState({});
  
  // Payment verification modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEventForPayments, setSelectedEventForPayments] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [processingPayment, setProcessingPayment] = useState({});
  const [isTeamEvent, setIsTeamEvent] = useState(false);

  useEffect(() => {
    fetchOrganizerEvents();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const timeParts = timeString.split(':');
    let hours = parseInt(timeParts[0]);
    const minutes = timeParts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  const categorizeEvents = (events) => {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    const categorized = {
      ongoing: [],
      completed: [],
      upcoming: []
    };

    events.forEach(event => {
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
  };

  const fetchOrganizerEvents = async () => {
    try {
      const response = await fetch('/api/my-organized-events', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/');
          return;
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const organizerEvents = data.organizerEvents || [];
      const categorizedEvents = categorizeEvents(organizerEvents);
      setEvents(categorizedEvents);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching organizer events:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleGenerateDetails = async (eventId, eventName) => {
    try {
      setGeneratingExcel(prev => ({ ...prev, [eventId]: true }));

      const response = await fetch(`/api/events/${eventId}/generate-details`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
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

      console.log('✅ Excel file downloaded successfully');
    } catch (err) {
      console.error('Error generating Excel file:', err);
      alert('Error generating Excel file. Please try again.');
    } finally {
      setGeneratingExcel(prev => ({ ...prev, [eventId]: false }));
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
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch pending payments');
      }

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
    setProcessingPayment(prev => ({ ...prev, [participantUSN]: 'verifying' }));

    try {
      const response = await fetch('/api/payments/verify', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          participantUSN,
          eventId
        })
      });

      if (!response.ok) {
        throw new Error('Failed to verify payment');
      }

      const data = await response.json();
      
      // Show success message with count if it's a team
      if (data.verifiedCount && data.verifiedCount > 1) {
        alert(`${data.message}\nAll ${data.verifiedCount} team members can now mark attendance.`);
      } else {
        alert(data.message || 'Payment verified successfully!');
      }
      
      // Refresh pending payments
      setPendingPayments(prev => prev.filter(p => p.partusn !== participantUSN));
    } catch (err) {
      console.error('Error verifying payment:', err);
      alert('Error verifying payment. Please try again.');
    } finally {
      setProcessingPayment(prev => ({ ...prev, [participantUSN]: null }));
    }
  };

  const handleEventButtonClick = (eventId, eventType) => {
    navigate(`/organiser-ticket?eventId=${eventId}`);
  };

  const handleOrganiseClick = () => {
    navigate('/create-event');
  };

  const handleBack = () => {
    navigate('/events');
  };

  const renderEventsList = (eventsList, eventType) => {
    if (loading) {
      return (
        <div className="event-item">
          <p><strong>Loading...</strong></p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="event-item">
          <p><strong>Error:</strong> Could not load events. {error}</p>
        </div>
      );
    }

    if (!eventsList || eventsList.length === 0) {
      return (
        <div className="event-item">
          <p><strong>No events available</strong></p>
        </div>
      );
    }

    return eventsList.map(event => (
      <div className="event-item" key={event.eid}>
        <div className="event-info">
          <p><strong>{event.ename || 'N/A'}</strong></p>
          <p><em>{event.eventdesc || 'No description'}</em></p>
          <p>Date: {formatDate(event.eventDate)}</p>
          <p>Time: {formatTime(event.eventTime)}</p>
          <p>Location: {event.eventLoc || 'N/A'}</p>
          <p>Max Participants: {event.maxPart || 'No limit'}</p>
          <p>Max Volunteers: {event.maxVoln || 'No limit'}</p>
          <p>Registration Fee: ₹{event.regFee || '0'}</p>
          {event.clubName && <p>Club: {event.clubName}</p>}
        </div>
        <div className="event-actions">
          {eventType !== 'completed' && (
            <button
              className="event-btn"
              onClick={() => handleEventButtonClick(event.eid, eventType)}
            >
              View Event
            </button>
          )}
          {event.regFee > 0 && eventType !== 'completed' && (
            <button
              className="event-btn event-btn-payment"
              onClick={() => handleViewPendingPayments(event)}
            >
              💳 Verify Payments
            </button>
          )}
          <button
            className="event-btn"
            onClick={() => handleGenerateDetails(event.eid, event.ename)}
            disabled={generatingExcel[event.eid]}
          >
            {generatingExcel[event.eid] ? 'Generating...' : 'Generate Details'}
          </button>
        </div>
      </div>
    ));
  };

  return (
    <div className="organisers-page">
      <div className="logout-container">
        <button id="backBtn" className="logout-btn" onClick={handleBack}>
          <i className="fas fa-arrow-left"></i>
          Back
        </button>
      </div>

      <section className="hero-section">
        <div className="container">
          <div className="card-grid">
            <div className="card" id="completed-card">
              <div className="card__background"></div>
              <div className="card__content">
                <h3 className="card__heading">Completed Events</h3>
                <div className="card__details">
                  {renderEventsList(events.completed, 'completed')}
                </div>
              </div>
            </div>

            <div className="card" id="ongoing-card">
              <div className="card__background"></div>
              <div className="card__content">
                <h3 className="card__heading">Ongoing Events</h3>
                <div className="card__details">
                  {renderEventsList(events.ongoing, 'ongoing')}
                </div>
              </div>
            </div>

            <div className="card" id="upcoming-card">
              <div className="card__background"></div>
              <div className="card__content">
                <h3 className="card__heading">Upcoming Events</h3>
                <div className="card__details">
                  {renderEventsList(events.upcoming, 'upcoming')}
                </div>
              </div>
            </div>
          </div>

          <div className="button-container">
            <button onClick={handleOrganiseClick}>
              Organise New Event
            </button>
          </div>
        </div>
      </section>

      {/* Payment Verification Modal */}
      {showPaymentModal && (
        <div className="payment-modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="payment-modal-header">
              <h2>💳 Pending Payment Verifications</h2>
              <p className="payment-modal-subtitle">
                {selectedEventForPayments?.ename}
                {isTeamEvent && <span className="team-badge"> 👥 Team Event</span>}
              </p>
              <button 
                className="payment-modal-close"
                onClick={() => setShowPaymentModal(false)}
              >
                ×
              </button>
            </div>

            <div className="payment-modal-body">
              {loadingPayments ? (
                <div className="payment-loading">
                  <div className="spinner"></div>
                  <p>Loading pending payments...</p>
                </div>
              ) : pendingPayments.length === 0 ? (
                <div className="no-payments">
                  <p>✅ No pending payments to verify</p>
                </div>
              ) : (
                <>
                  {isTeamEvent && (
                    <div className="team-event-notice">
                      <p>
                        <strong>ℹ️ Team Event Notice:</strong> Verifying a team leader's payment will automatically verify all team members' payments.
                      </p>
                    </div>
                  )}
                  <div className="payments-list">
                    {pendingPayments.map((payment, index) => (
                      <div key={index} className="payment-card">
                        <div className="payment-info">
                          <div className="payment-header-row">
                            <h3 className="payment-student-name">
                              {payment.studentName || 'Unknown'}
                              {payment.isTeamLeader && (
                                <span className="team-leader-badge"> 👑 Team Leader</span>
                              )}
                            </h3>
                            <span className="payment-amount">₹{payment.amount}</span>
                          </div>
                          
                          <div className="payment-details">
                            <div className="payment-detail-item">
                              <span className="detail-label">USN:</span>
                              <span className="detail-value">{payment.partusn}</span>
                            </div>
                            <div className="payment-detail-item">
                              <span className="detail-label">Email:</span>
                              <span className="detail-value">{payment.studentEmail || 'N/A'}</span>
                            </div>
                            <div className="payment-detail-item">
                              <span className="detail-label">Mobile:</span>
                              <span className="detail-value">{payment.studentMobile || 'N/A'}</span>
                            </div>
                            <div className="payment-detail-item">
                              <span className="detail-label">Transaction ID:</span>
                              <span className="detail-value transaction-id">
                                {payment.transactionId || 'N/A'}
                              </span>
                            </div>
                            {payment.teamName && (
                              <>
                                <div className="payment-detail-item">
                                  <span className="detail-label">Team:</span>
                                  <span className="detail-value">{payment.teamName}</span>
                                </div>
                                {payment.teamMemberCount && (
                                  <div className="payment-detail-item">
                                    <span className="detail-label">Team Size:</span>
                                    <span className="detail-value">
                                      {payment.teamMemberCount} member{payment.teamMemberCount !== 1 ? 's' : ''}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                            <div className="payment-detail-item">
                              <span className="detail-label">Submitted:</span>
                              <span className="detail-value">
                                {payment.submittedAt ? new Date(payment.submittedAt).toLocaleString() : 'N/A'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="payment-actions">
                          <button
                            className="payment-btn payment-btn-approve"
                            onClick={() => handleVerifyPayment(payment.partusn, selectedEventForPayments.eid)}
                            disabled={processingPayment[payment.partusn]}
                          >
                            {processingPayment[payment.partusn] === 'verifying' ? (
                              <>
                                <span className="btn-spinner"></span>
                                Approving...
                              </>
                            ) : (
                              <>
                                ✓ Approve Payment
                                {payment.isTeamLeader && payment.teamMemberCount > 1 && (
                                  <span className="approve-count"> (All {payment.teamMemberCount})</span>
                                )}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Organisers;
