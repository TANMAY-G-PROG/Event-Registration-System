import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, MapPin, CreditCard, 
  ArrowLeft, Download, TrendingUp, 
  Activity, CheckCircle, AlertCircle, X, Loader2, Users 
} from 'lucide-react';
import './organisers.css'; // Make sure this path is correct

const Organisers = () => {
  const navigate = useNavigate();
  
  // --- State ---
  const [events, setEvents] = useState({ ongoing: [], completed: [], upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingExcel, setGeneratingExcel] = useState({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [processingPayment, setProcessingPayment] = useState({});
  const [isTeamEvent, setIsTeamEvent] = useState(false);

  // --- Helpers ---
  const categorizeEvents = useCallback((eventsList) => {
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const categorized = { ongoing: [], completed: [], upcoming: [] };

    eventsList.forEach((event) => {
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
      const response = await fetch('/api/my-organized-events');
      if (!response.ok) {
         if (response.status === 401) return navigate('/');
         throw new Error('Failed to fetch');
      }
      const data = await response.json();
      setEvents(categorizeEvents(data.organizerEvents || []));
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrganizerEvents(); }, []);

  // --- Stats Calculation ---
  const stats = useMemo(() => {
    const allEvents = [...events.ongoing, ...events.upcoming, ...events.completed];
    const totalEvents = allEvents.length;
    const totalRev = allEvents.reduce((acc, curr) => acc + (curr.regFee || 0), 0);
    const activeEvents = events.ongoing.length + events.upcoming.length;
    return { totalEvents, totalRev, activeEvents };
  }, [events]);

  // --- Handlers ---
  const handleGenerateDetails = async (e, eventId, eventName) => {
    e.stopPropagation();
    setGeneratingExcel(prev => ({ ...prev, [eventId]: true }));
    try {
        const response = await fetch(`/api/events/${eventId}/generate-details`);
        if (!response.ok) throw new Error('Failed');
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Event_${eventName.replace(/\s+/g, '_')}_Details.xlsx`;
        a.click();
    } catch (err) { alert('Error generating file'); } 
    finally { setGeneratingExcel(prev => ({ ...prev, [eventId]: false })); }
  };

  const openPaymentModal = async (e, event) => {
    e.stopPropagation();
    setSelectedEvent(event);
    setShowPaymentModal(true);
    setLoadingPayments(true);
    try {
        const res = await fetch(`/api/events/${event.eid}/pending-payments`);
        const data = await res.json();
        setPendingPayments(data.pendingPayments || []);
        setIsTeamEvent(data.isTeamEvent || false);
    } catch (err) { setPendingPayments([]); } 
    finally { setLoadingPayments(false); }
  };

  const verifyPayment = async (usn, eventId) => {
    setProcessingPayment(prev => ({ ...prev, [usn]: 'verifying' }));
    try {
        const res = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ participantUSN: usn, eventId })
        });
        const data = await res.json();
        if(!res.ok) throw new Error(data.error);
        
        setProcessingPayment(prev => ({ ...prev, [usn]: 'success' }));
        setTimeout(() => {
            setPendingPayments(prev => prev.filter(p => p.partusn !== usn));
            setProcessingPayment(prev => ({ ...prev, [usn]: null }));
        }, 1000);
    } catch (err) {
        alert(err.message);
        setProcessingPayment(prev => ({ ...prev, [usn]: null }));
    }
  };

  // --- Sub-Components ---
  const EventCard = ({ event, type }) => {
    const isCompleted = type === 'completed';
    const badgeColor = isCompleted ? 'orange' : type === 'ongoing' ? 'green' : 'blue';
    const badgeText = isCompleted ? 'Completed' : type === 'ongoing' ? 'Live Now' : 'Upcoming';

    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="glass-panel"
      >
        <div className="card-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
             <span className={`badge ${badgeColor}`}>{badgeText}</span>
             {event.regFee > 0 && <span style={{ color: '#34d399', fontWeight: 'bold' }}>₹{event.regFee}</span>}
          </div>

          <h3 style={{ fontSize: '1.5rem', margin: '0 0 0.5rem 0', fontWeight: 'bold' }}>{event.ename}</h3>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
            {event.eventdesc || "No description provided."}
          </p>

          <div className="event-info-row"><Calendar size={16}/> {new Date(event.eventDate).toLocaleDateString()}</div>
          <div className="event-info-row"><Clock size={16}/> {event.eventTime}</div>
          <div className="event-info-row"><MapPin size={16}/> {event.eventLoc}</div>
        </div>

        <div className="card-actions">
            {!isCompleted && (
                 <button className="btn-glass" style={{flex: 1, justifyContent: 'center'}} onClick={() => navigate(`/organiser-ticket?eventId=${event.eid}`)}>
                    View
                 </button>
            )}
            {!isCompleted && event.regFee > 0 && (
                <button className="btn-glass btn-verify" style={{flex: 1, justifyContent: 'center'}} onClick={(e) => openPaymentModal(e, event)}>
                    <CreditCard size={14} /> Verify
                </button>
            )}
            <button className="btn-glass" onClick={(e) => handleGenerateDetails(e, event.eid, event.ename)}>
               {generatingExcel[event.eid] ? <Loader2 className="spinner" size={18}/> : <Download size={18} />}
            </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="dashboard-container">
        {/* Background FX */}
        <div className="ambient-background">
            <div className="glow-orb orb-1" />
            <div className="glow-orb orb-2" />
            <div className="glow-orb orb-3" />
        </div>

        {/* Top Header */}
        <div className="header-row">
            <button className="btn-glass" onClick={() => navigate('/events')}>
                <ArrowLeft size={16} /> Back to Hub
            </button>
            <button className="btn-primary" onClick={() => navigate('/create-event')}>
                + Create Event
            </button>
        </div>

        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="header-section" 
            style={{marginBottom: '3rem'}}
        >
            <h1 className="hero-title">Organizer <span className="text-gradient">Dashboard</span></h1>
            <p className="subtitle">Manage events, verify payments, and track metrics.</p>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid-3">
            <div className="glass-panel">
                <div style={{display:'flex', justifyContent:'space-between'}}>
                    <div><p className="stat-label">Active Events</p><h3 className="stat-value">{stats.activeEvents}</h3></div>
                    <Activity color="#a78bfa" />
                </div>
            </div>
            <div className="glass-panel">
                <div style={{display:'flex', justifyContent:'space-between'}}>
                    <div><p className="stat-label">Total Events</p><h3 className="stat-value">{stats.totalEvents}</h3></div>
                    <Calendar color="#60a5fa" />
                </div>
            </div>
            <div className="glass-panel">
                <div style={{display:'flex', justifyContent:'space-between'}}>
                    <div><p className="stat-label">Est. Revenue</p><h3 className="stat-value">₹{stats.totalRev}</h3></div>
                    <TrendingUp color="#34d399" />
                </div>
            </div>
        </div>

        {/* Content */}
        {loading ? (
            <div style={{display:'flex', justifyContent:'center', padding: '4rem'}}>
                <Loader2 size={40} className="spinner" color="#3b82f6" />
            </div>
        ) : error ? (
            <div className="glass-panel" style={{borderColor: '#ef4444', color: '#f87171', textAlign: 'center'}}>
                <AlertCircle style={{margin: '0 auto 10px'}}/> {error}
            </div>
        ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4rem' }}>
                {events.ongoing.length > 0 && (
                    <section>
                        <h2 style={{fontSize: '1.5rem', marginBottom: '1.5rem'}}>Happening Now</h2>
                        <div className="grid-3">
                            {events.ongoing.map(ev => <EventCard key={ev.eid} event={ev} type="ongoing" />)}
                        </div>
                    </section>
                )}
                <section>
                    <h2 style={{fontSize: '1.5rem', marginBottom: '1.5rem'}}>Upcoming Events</h2>
                    {events.upcoming.length > 0 ? (
                        <div className="grid-3">
                            {events.upcoming.map(ev => <EventCard key={ev.eid} event={ev} type="upcoming" />)}
                        </div>
                    ) : <p className="subtitle">No upcoming events found.</p>}
                </section>
                {events.completed.length > 0 && (
                    <section style={{opacity: 0.6}}>
                        <h2 style={{fontSize: '1.5rem', marginBottom: '1.5rem'}}>Past Events</h2>
                        <div className="grid-3">
                            {events.completed.map(ev => <EventCard key={ev.eid} event={ev} type="completed" />)}
                        </div>
                    </section>
                )}
            </div>
        )}

        {/* Payment Modal */}
        <AnimatePresence>
            {showPaymentModal && (
                <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="modal-content"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="modal-header">
                            <div>
                                <h2 style={{fontSize:'1.25rem', fontWeight:'bold', display:'flex', alignItems:'center', gap:'10px'}}>
                                    <CreditCard size={20} color="#34d399"/> Verify Payments
                                </h2>
                                <p style={{fontSize:'0.9rem', color:'rgba(255,255,255,0.5)', margin:0}}>
                                    {selectedEvent?.ename} {isTeamEvent && '• Team Event'}
                                </p>
                            </div>
                            <button onClick={() => setShowPaymentModal(false)} style={{background:'none', border:'none', color:'white', cursor:'pointer'}}>
                                <X />
                            </button>
                        </div>
                        <div className="modal-body">
                            {loadingPayments ? (
                                <div style={{textAlign:'center', padding:'2rem'}}><Loader2 className="spinner" style={{margin:'0 auto'}}/></div>
                            ) : pendingPayments.length === 0 ? (
                                <div style={{textAlign:'center', padding:'2rem', color:'rgba(255,255,255,0.3)'}}>
                                    <CheckCircle size={48} style={{margin:'0 auto 10px'}}/>
                                    <p>All payments verified!</p>
                                </div>
                            ) : (
                                <div>
                                    {isTeamEvent && (
                                        <div style={{padding:'10px', background:'rgba(59,130,246,0.1)', borderRadius:'8px', marginBottom:'1rem', display:'flex', gap:'10px', fontSize:'0.9rem', color:'#93c5fd'}}>
                                            <Users size={16} /> <span>Approving a Team Leader approves the whole team.</span>
                                        </div>
                                    )}
                                    {pendingPayments.map(payment => (
                                        <div key={payment.partusn} className="payment-row">
                                            <div style={{flex: 1}}>
                                                <h4 style={{margin:0, fontWeight:'bold'}}>
                                                    {payment.studentName}
                                                    {payment.isTeamLeader && <span className="badge purple" style={{marginLeft:'8px', fontSize:'0.7rem'}}>Leader</span>}
                                                </h4>
                                                <p style={{margin:'4px 0 0', fontSize:'0.8rem', color:'rgba(255,255,255,0.5)'}}>{payment.partusn}</p>
                                            </div>
                                            <div style={{textAlign:'right'}}>
                                                <div style={{fontWeight:'bold', fontSize:'1.1rem'}}>₹{payment.amount}</div>
                                                <div style={{fontSize:'0.7rem', color:'rgba(255,255,255,0.4)'}}>{payment.transactionId}</div>
                                            </div>
                                            <button 
                                                onClick={() => verifyPayment(payment.partusn, selectedEvent.eid)}
                                                disabled={!!processingPayment[payment.partusn]}
                                                className="btn-primary"
                                                style={{
                                                    padding: '8px 16px', fontSize: '0.9rem',
                                                    background: processingPayment[payment.partusn] === 'success' ? '#10b981' : '#2563eb'
                                                }}
                                            >
                                                {processingPayment[payment.partusn] === 'verifying' ? <Loader2 className="spinner" size={16}/> : 
                                                 processingPayment[payment.partusn] === 'success' ? <CheckCircle size={16}/> : 'Approve'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    </div>
  );
};

export default Organisers;
