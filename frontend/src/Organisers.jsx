import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, Clock, MapPin, Users, CreditCard, 
  ArrowLeft, Download, ShieldCheck, TrendingUp, 
  Activity, CheckCircle, AlertCircle, X, Loader2 
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import './organisers.css';

// --- Utility for cleaner classes ---
function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// --- Visual Components ---
const GlassCard = ({ children, className, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease: "easeOut" }}
    className={cn(
      "relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:shadow-2xl hover:shadow-cyan-500/10 group",
      className
    )}
  >
    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
    {children}
  </motion.div>
);

const Badge = ({ children, color = "blue" }) => {
  const colors = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    green: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  };
  return (
    <span className={cn("px-3 py-1 rounded-full text-xs font-medium border backdrop-blur-md", colors[color])}>
      {children}
    </span>
  );
};

const StatCard = ({ label, value, icon: Icon, trend, delay }) => (
  <GlassCard className="p-6 flex items-start justify-between" delay={delay}>
    <div>
      <p className="text-gray-400 text-sm font-medium mb-1">{label}</p>
      <h3 className="text-3xl font-bold font-[Space_Grotesk] bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
        {value}
      </h3>
    </div>
    <div className={cn("p-3 rounded-xl bg-white/5 border border-white/10 text-white/70")}>
      <Icon size={24} />
    </div>
    {trend && (
        <div className="absolute bottom-6 right-6 flex items-center gap-1 text-emerald-400 text-xs font-mono">
            <TrendingUp size={12} />
            {trend}
        </div>
    )}
  </GlassCard>
);

const Organisers = () => {
  const navigate = useNavigate();
  
  // --- State ---
  const [events, setEvents] = useState({ ongoing: [], completed: [], upcoming: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Action States
  const [generatingExcel, setGeneratingExcel] = useState({});
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [processingPayment, setProcessingPayment] = useState({});
  const [isTeamEvent, setIsTeamEvent] = useState(false);

  // --- Logic ---
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
      // Simulation for demo purposes if API fails (remove in production)
      /* const mockEvents = [
         { eid: 1, ename: "Hackathon 2025", eventdesc: "AI Innovation Challenge", eventDate: "2025-11-25", eventTime: "10:00", eventLoc: "Tech Park", maxPart: 100, regFee: 500, clubName: "Coding Club" },
         { eid: 2, ename: "Cyber Summit", eventdesc: "Security Workshop", eventDate: "2025-12-01", eventTime: "09:00", eventLoc: "Auditorium", maxPart: 50, regFee: 200, clubName: "CyberCell" }
      ]; */
      
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

  // --- Stats Calculation (Memoized) ---
  const stats = useMemo(() => {
    const allEvents = [...events.ongoing, ...events.upcoming, ...events.completed];
    const totalEvents = allEvents.length;
    const totalRev = allEvents.reduce((acc, curr) => acc + (curr.regFee || 0), 0); // Simplified logic
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
        
        // Success Animation Delay
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
    
    return (
      <GlassCard className="group relative flex flex-col h-full min-h-[280px]">
        {/* Decorative Gradient Blob */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-400/30 transition-all duration-500" />

        <div className="p-6 flex-1 relative z-10">
          <div className="flex justify-between items-start mb-4">
             <Badge color={isCompleted ? "orange" : type === 'ongoing' ? "green" : "blue"}>
                {isCompleted ? 'Completed' : type === 'ongoing' ? 'Happening Now' : 'Upcoming'}
             </Badge>
             {event.regFee > 0 && (
                 <span className="text-emerald-400 font-mono font-bold text-lg">₹{event.regFee}</span>
             )}
          </div>

          <h3 className="text-2xl font-bold text-white mb-2 leading-tight group-hover:text-blue-300 transition-colors">
            {event.ename}
          </h3>
          <p className="text-white/60 text-sm line-clamp-2 mb-6 h-10">
            {event.eventdesc || "No description provided."}
          </p>

          <div className="space-y-3">
             <div className="flex items-center text-sm text-white/50 gap-3">
                <Calendar size={16} className="text-blue-400" />
                <span>{new Date(event.eventDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
             </div>
             <div className="flex items-center text-sm text-white/50 gap-3">
                <Clock size={16} className="text-purple-400" />
                <span>{event.eventTime}</span>
             </div>
             <div className="flex items-center text-sm text-white/50 gap-3">
                <MapPin size={16} className="text-pink-400" />
                <span>{event.eventLoc}</span>
             </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="p-4 border-t border-white/5 bg-black/20 backdrop-blur-md flex gap-2">
            {!isCompleted && (
                 <button 
                    onClick={() => navigate(`/organiser-ticket?eventId=${event.eid}`)}
                    className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-all flex items-center justify-center gap-2 border border-white/5 hover:border-white/20"
                 >
                    View
                 </button>
            )}
            
            {!isCompleted && event.regFee > 0 && (
                <button 
                    onClick={(e) => openPaymentModal(e, event)}
                    className="flex-1 py-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                    <CreditCard size={14} /> Verify
                </button>
            )}

            <button 
                onClick={(e) => handleGenerateDetails(e, event.eid, event.ename)}
                disabled={generatingExcel[event.eid]}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-all border border-white/5"
                title="Download Report"
            >
               {generatingExcel[event.eid] ? <Loader2 className="animate-spin" size={18}/> : <Download size={18} />}
            </button>
        </div>
      </GlassCard>
    );
  };

  // --- Main Render ---
  return (
    <div className="min-h-screen w-full relative p-6 md:p-12">
        {/* Background FX */}
        <div className="noise-overlay" />
        <div className="ambient-glow purple" />
        <div className="ambient-glow blue" />
        <div className="ambient-glow cyan" />

        {/* Top Nav */}
        <div className="max-w-7xl mx-auto flex justify-between items-center mb-12 relative z-10">
            <button 
                onClick={() => navigate('/events')}
                className="group flex items-center gap-2 text-white/60 hover:text-white transition-colors"
            >
                <div className="p-2 rounded-full bg-white/5 border border-white/10 group-hover:border-white/30 transition-all">
                    <ArrowLeft size={16} />
                </div>
                <span className="font-medium tracking-wide">Back to Hub</span>
            </button>

            <button 
                onClick={() => navigate('/create-event')}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-full font-medium shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40 transition-all transform hover:-translate-y-0.5"
            >
                + Create Event
            </button>
        </div>

        <div className="max-w-7xl mx-auto relative z-10 space-y-12">
            
            {/* Dashboard Header & Stats */}
            <div className="space-y-8">
                <div>
                    <h1 className="text-5xl md:text-6xl font-bold font-[Space_Grotesk] text-white tracking-tight mb-4">
                        Organizer <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">Dashboard</span>
                    </h1>
                    <p className="text-lg text-white/50 max-w-2xl">
                        Manage your events, verify payments, and track participation in real-time.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard label="Total Active Events" value={stats.activeEvents} icon={Activity} delay={0.1} />
                    <StatCard label="Total Lifetime Events" value={stats.totalEvents} icon={Calendar} delay={0.2} />
                    <StatCard label="Est. Revenue" value={`₹${stats.totalRev.toLocaleString()}`} icon={TrendingUp} delay={0.3} trend="+12% this month" />
                </div>
            </div>

            {/* Content Sections */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 size={40} className="text-blue-500 animate-spin" />
                </div>
            ) : error ? (
                <div className="p-8 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-center">
                    <AlertCircle className="mx-auto mb-2" size={32} />
                    <p>{error}</p>
                </div>
            ) : (
                <div className="space-y-16">
                    {/* Ongoing Section */}
                    {events.ongoing.length > 0 && (
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <div className="w-2 h-8 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                                <h2 className="text-2xl font-bold text-white">Live Events</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {events.ongoing.map((ev, i) => <EventCard key={ev.eid} event={ev} type="ongoing" />)}
                            </div>
                        </section>
                    )}

                    {/* Upcoming Section */}
                    <section>
                        <div className="flex items-center gap-3 mb-6">
                             <div className="w-2 h-8 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
                             <h2 className="text-2xl font-bold text-white">Upcoming</h2>
                        </div>
                        {events.upcoming.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {events.upcoming.map((ev, i) => <EventCard key={ev.eid} event={ev} type="upcoming" />)}
                            </div>
                        ) : (
                            <p className="text-white/30 italic">No upcoming events scheduled.</p>
                        )}
                    </section>

                    {/* Completed Section (Collapsed Visual Style) */}
                    {events.completed.length > 0 && (
                        <section className="opacity-60 hover:opacity-100 transition-opacity duration-500">
                             <div className="flex items-center gap-3 mb-6">
                                 <div className="w-2 h-8 bg-gray-500 rounded-full" />
                                 <h2 className="text-2xl font-bold text-white">Past Events</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {events.completed.map((ev, i) => <EventCard key={ev.eid} event={ev} type="completed" />)}
                            </div>
                        </section>
                    )}
                </div>
            )}
        </div>

        {/* --- PREMIUM PAYMENT MODAL --- */}
        <AnimatePresence>
            {showPaymentModal && (
                <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    onClick={() => setShowPaymentModal(false)}
                >
                    <motion.div 
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        onClick={e => e.stopPropagation()}
                        className="w-full max-w-4xl bg-[#0a0a0f] border border-white/10 rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col"
                    >
                        {/* Modal Header */}
                        <div className="p-6 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                                    <CreditCard className="text-emerald-400" />
                                    Verification Portal
                                </h2>
                                <p className="text-white/40 text-sm mt-1">
                                    {selectedEvent?.ename} • {isTeamEvent ? 'Team Event' : 'Individual'}
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowPaymentModal(false)}
                                className="p-2 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
                            {loadingPayments ? (
                                <div className="flex flex-col items-center justify-center h-64 space-y-4">
                                    <Loader2 size={48} className="text-blue-500 animate-spin" />
                                    <p className="text-white/50 text-sm animate-pulse">Fetching transactions...</p>
                                </div>
                            ) : pendingPayments.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-64 space-y-4 text-white/30">
                                    <ShieldCheck size={64} />
                                    <p>All payments verified.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {isTeamEvent && (
                                        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-sm flex items-start gap-3">
                                            <Users size={18} className="mt-0.5" />
                                            <p><strong>Batch Action:</strong> Verifying a team leader approves the entire group automatically.</p>
                                        </div>
                                    )}
                                    
                                    {pendingPayments.map((payment, idx) => (
                                        <motion.div 
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            key={payment.partusn}
                                            className="group p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 hover:bg-white/[0.07] transition-all flex flex-col md:flex-row gap-6 items-center"
                                        >
                                            <div className="flex-1 space-y-1 w-full text-center md:text-left">
                                                <h4 className="text-lg font-bold text-white flex items-center justify-center md:justify-start gap-2">
                                                    {payment.studentName}
                                                    {payment.isTeamLeader && <Badge color="purple">Leader</Badge>}
                                                </h4>
                                                <p className="text-sm text-white/50 font-mono">{payment.partusn}</p>
                                                <div className="flex items-center justify-center md:justify-start gap-4 text-xs text-white/40 mt-2">
                                                    <span>Mobile: {payment.studentMobile}</span>
                                                    <span>•</span>
                                                    <span className="font-mono bg-white/5 px-2 py-0.5 rounded">ID: {payment.transactionId}</span>
                                                </div>
                                            </div>

                                            <div className="text-center md:text-right min-w-[120px]">
                                                <div className="text-2xl font-bold text-white mb-1">₹{payment.amount}</div>
                                                <div className="text-xs text-white/40">{new Date(payment.submittedAt).toLocaleDateString()}</div>
                                            </div>

                                            <button 
                                                onClick={() => verifyPayment(payment.partusn, selectedEvent.eid)}
                                                disabled={!!processingPayment[payment.partusn]}
                                                className={cn(
                                                    "w-full md:w-auto px-6 py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2",
                                                    processingPayment[payment.partusn] === 'success' 
                                                        ? "bg-emerald-500 text-white" 
                                                        : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white shadow-lg shadow-blue-500/20"
                                                )}
                                            >
                                                {processingPayment[payment.partusn] === 'verifying' ? (
                                                    <Loader2 size={18} className="animate-spin" />
                                                ) : processingPayment[payment.partusn] === 'success' ? (
                                                    <><CheckCircle size={18} /> Verified</>
                                                ) : (
                                                    "Approve"
                                                )}
                                            </button>
                                        </motion.div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
};

export default Organisers;
