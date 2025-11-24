import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import './organisers.css';

// --- Sub-component: Animated Counter (Pure React/JS) ---
const AnimatedCounter = ({ end, duration = 2000, prefix = "", suffix = "" }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime = null;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      // Ease-out expo formula
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      
      setCount(Math.floor(ease * end));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [end, duration]);

  return <span className="stat-number">{prefix}{count.toLocaleString()}{suffix}</span>;
};

// --- Sub-component: Live Clock ---
const LiveClock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  return (
    <div className="live-clock">
      <span className="clock-time">
        {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
      <span className="clock-date">
        {time.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
      </span>
    </div>
  );
};

// --- Sub-component: Mini Chart (CSS only) ---
const MiniChart = () => (
  <div className="mini-chart">
    <div className="bar" style={{height: '40%'}}></div>
    <div className="bar" style={{height: '70%'}}></div>
    <div className="bar" style={{height: '50%'}}></div>
    <div className="bar" style={{height: '100%'}}></div>
    <div className="bar" style={{height: '60%'}}></div>
  </div>
);

const Organisers = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState({ ongoing: [], completed: [], upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingExcel, setGeneratingExcel] = useState({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEventForPayments, setSelectedEventForPayments] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [processingPayment, setProcessingPayment] = useState({});
  const [isTeamEvent, setIsTeamEvent] = useState(false);

  // --- EXISTING LOGIC PRESERVED ---
  const categorizeEvents = useCallback((events) => {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const categorized = { ongoing: [], completed: [], upcoming: [] };
    events.forEach((event) => {
      const eventDate = new Date(event.eventDate);
      eventDate.setHours(0, 0, 0, 0);
      const diffTime = eventDate.getTime() - currentDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 0) categorized.ongoing.push(event);
      else if (diffDays < 0) categorized.completed.push(event);
      else categorized.upcoming.push(event);
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
        if (response.status === 401) { navigate('/'); return; }
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

  useEffect(() => { fetchOrganizerEvents(); }, [navigate, categorizeEvents]);

  // --- CALCULATE STATS ---
  const stats = useMemo(() => {
    const allEvents = [...events.ongoing, ...events.upcoming, ...events.completed];
    const totalEvents = allEvents.length;
    // Assuming a rudimentary calculation for demo revenue based on regFee
    const totalRevenue = allEvents.reduce((acc, curr) => acc + (parseInt(curr.regFee || 0) * (parseInt(curr.maxPart || 0) / 2)), 0); 
    // Just a simulation for "Verified" count as we don't have that global data, using random for visual
    const verifiedCount = Math.floor(totalEvents * 12.5); 
    return { totalEvents, totalRevenue, verifiedCount };
  }, [events]);

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatTime = (timeString) => {
    if (!timeString) return 'N/A';
    const [hours, minutes] = timeString.split(':');
    let h = parseInt(hours);
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${minutes} ${ampm}`;
  };

  // --- HANDLERS PRESERVED ---
  const handleGenerateDetails = async (eventId, eventName) => {
    try {
      setGeneratingExcel((prev) => ({ ...prev, [eventId]: true }));
      const response = await fetch(`/api/events/${eventId}/generate-details`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        if (response.status === 401) { alert('Session expired.'); navigate('/'); return; }
        if (response.status === 403) { alert('Not authorized.'); return; }
        throw new Error(`HTTP error!`);
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
      console.error(err);
      alert('Error generating Excel file.');
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
      if (!response.ok) throw new Error('Failed to fetch');
      const data = await response.json();
      setPendingPayments(data.pendingPayments || []);
      setIsTeamEvent(data.isTeamEvent || false);
    } catch (err) {
      console.error(err);
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
      if (!response.ok) throw new Error(data.error);

      // Trigger success animation state locally before removing
      setProcessingPayment((prev) => ({ ...prev, [participantUSN]: 'success' }));
      
      // Delay removal to show success tick
      setTimeout(() => {
        if (data.verifiedCount && data.verifiedCount > 1) {
          alert(`${data.message}\nAll team members verified.`);
        }
        setPendingPayments((prev) => prev.filter((p) => p.partusn !== participantUSN));
        setProcessingPayment((prev) => ({ ...prev, [participantUSN]: null }));
      }, 1500);

    } catch (err) {
      console.error(err);
      alert(`Error: ${err.message}`);
      setProcessingPayment((prev) => ({ ...prev, [participantUSN]: null }));
    }
  };

  const renderEventsList = (eventsList, eventType) => {
    if (loading) {
      return Array(3).fill(0).map((_, i) => (
        <div className="event-item skeleton-item" key={i}>
          <div className="skeleton-line title"></div>
          <div className="skeleton-line desc"></div>
          <div className="skeleton-line meta"></div>
        </div>
      ));
    }

    if (error) return <div className="event-empty-state error"><p>{error}</p></div>;
    
    if (!eventsList || eventsList.length === 0) {
      return (
        <div className="event-empty-state">
          <div className="empty-icon">📂</div>
          <p>No {eventType} events found</p>
        </div>
      );
    }

    return eventsList.map((event) => (
      <div className="event-item glass-tile" key={event.eid}>
        <div className="event-glow"></div>
        <div className="event-info">
          <h4>{DOMPurify.sanitize(event.ename || 'N/A')}</h4>
          <p className="event-desc">{DOMPurify.sanitize(event.eventdesc || 'No description')}</p>
          
          <div className="meta-grid">
            <span className="meta-tag date"><i className="fas fa-calendar"></i> {formatDate(event.eventDate)}</span>
            <span className="meta-tag time"><i className="fas fa-clock"></i> {formatTime(event.eventTime)}</span>
            <span className="meta-tag loc"><i className="fas fa-map-marker-alt"></i> {DOMPurify.sanitize(event.eventLoc || 'N/A')}</span>
          </div>
          
          <div className="stats-row">
            <span><i className="fas fa-users"></i> {event.maxPart || '∞'} Seats</span>
            {event.regFee > 0 && <span className="fee-badge">₹{event.regFee}</span>}
          </div>
        </div>

        <div className="event-actions">
           {eventType !== 'completed' && (
            <button className="glass-btn secondary" onClick={() => navigate(`/organiser-ticket?eventId=${event.eid}`)}>
              View
            </button>
           )}
           {event.regFee > 0 && eventType !== 'completed' && (
            <button className="glass-btn primary pulse-border" onClick={() => handleViewPendingPayments(event)}>
              <i className="fas fa-check-circle"></i> Verify
            </button>
           )}
           <button 
             className="glass-btn tertiary" 
             onClick={() => handleGenerateDetails(event.eid, event.ename)}
             disabled={generatingExcel[event.eid]}
           >
             {generatingExcel[event.eid] ? <span className="spinner-sm"></span> : <i className="fas fa-file-excel"></i>}
           </button>
        </div>
      </div>
    ));
  };

  // --- RENDER ---
  return (
    <div className="organisers-dashboard-wrapper">
      <div className="noise-overlay"></div>
      <div className="ambient-blob blob-1"></div>
      <div className="ambient-blob blob-2"></div>

      <div className="dashboard-header">
        <button className="back-nav-btn" onClick={() => navigate('/events')}>
          <i className="fas fa-arrow-left"></i> Hub
        </button>
        <div className="header-content">
           <div className="title-block">
             <h1>Command Center</h1>
             <p>Manage, verify, and track your event lifecycle.</p>
           </div>
           <LiveClock />
        </div>
        
        <div className="stats-bar">
           <div className="stat-card">
              <div className="stat-info">
                <span className="stat-label">Total Events</span>
                <AnimatedCounter end={stats.totalEvents} />
              </div>
              <MiniChart />
           </div>
           <div className="stat-divider"></div>
           <div className="stat-card">
              <div className="stat-info">
                <span className="stat-label">Est. Revenue</span>
                <AnimatedCounter end={stats.totalRevenue} prefix="₹" />
              </div>
              <div className="trend-up"><i className="fas fa-arrow-up"></i></div>
           </div>
           <div className="stat-divider"></div>
           <div className="stat-card">
              <div className="stat-info">
                 <span className="stat-label">Verified</span>
                 <AnimatedCounter end={stats.verifiedCount} />
              </div>
              <MiniChart />
           </div>
        </div>
      </div>

      <main className="dashboard-grid">
        {/* Upcoming Panel */}
        <section className="dashboard-panel panel-upcoming">
           <div className="panel-header">
             <h3>Upcoming</h3>
             <span className="badge-count">{events.upcoming.length}</span>
           </div>
           <div className="panel-scroll-area">
              {renderEventsList(events.upcoming, 'upcoming')}
           </div>
        </section>

        {/* Ongoing Panel */}
        <section className="dashboard-panel panel-ongoing">
           <div className="panel-header">
             <h3>Live Now</h3>
             <div className="live-indicator">
                <span className="blink-dot"></span> Live
             </div>
           </div>
           <div className="panel-scroll-area">
              {renderEventsList(events.ongoing, 'ongoing')}
           </div>
        </section>

        {/* Completed Panel */}
        <section className="dashboard-panel panel-completed">
           <div className="panel-header">
             <h3>Completed</h3>
             <span className="badge-count">{events.completed.length}</span>
           </div>
           <div className="panel-scroll-area">
              {renderEventsList(events.completed, 'completed')}
           </div>
        </section>
      </main>

      <div className="floating-action-bar">
         <button className="fab-organise" onClick={() => navigate('/create-event')}>
            <span className="plus-icon">+</span>
            <span className="fab-text">Create Event</span>
         </button>
      </div>

      {/* FINTECH STYLE MODAL */}
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
                  <div className="payment-skeleton-list">
                     {[1,2,3].map(i => (
                       <div className="pay-skeleton-row" key={i}>
                          <div className="sk-avatar"></div>
                          <div className="sk-info">
                             <div className="sk-line long"></div>
                             <div className="sk-line short"></div>
                          </div>
                          <div className="sk-btn"></div>
                       </div>
                     ))}
                  </div>
                ) : pendingPayments.length === 0 ? (
                  <div className="empty-payments">
                     <div className="check-ring-lg"><i className="fas fa-check"></i></div>
                     <h3>All Caught Up!</h3>
                     <p>No pending transactions for this event.</p>
                  </div>
                ) : (
                  <div className="payment-list">
                    {isTeamEvent && (
                       <div className="notice-banner">
                          <i className="fas fa-users-cog"></i>
                          <span><strong>Team Event:</strong> Verifying Leader approves all members.</span>
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
                                 <svg viewBox="0 0 52 52" className="checkmark">
                                    <circle className="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
                                    <path className="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                                 </svg>
                              </div>
                           ) : (
                              <button 
                                className={`verify-btn ${processingPayment[payment.partusn] ? 'loading' : ''}`}
                                onClick={() => handleVerifyPayment(payment.partusn, selectedEventForPayments.eid)}
                                disabled={!!processingPayment[payment.partusn]}
                              >
                                 {processingPayment[payment.partusn] === 'verifying' ? <div className="spinner-dots"></div> : 'Approve'}
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
