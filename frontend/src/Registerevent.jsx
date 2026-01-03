"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import QRCode from "qrcode"
import "./registerevent.css"
import TicketAnimation from './TicketAnimation';

// --- CUSTOM DITHER BANNER (HTML5 Canvas - No Libs) ---
const CustomDitherBanner = ({ bannerUrl, eventName }) => {
  const canvasRef = useRef(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Helper: Convert Drive Link to thumbnail
  const imgUrl = useMemo(() => {
    if (!bannerUrl) return null;
    const idMatch = bannerUrl.match(/\/d\/(.+?)\/|id=(.+?)(&|$)/);
    const fileId = idMatch ? (idMatch[1] || idMatch[2]) : null;
    return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w800` : null;
  }, [bannerUrl]);

  // Fallback gradient
  const gradient = useMemo(() => {
    let hash = 0;
    const str = eventName || 'Event';
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const c1 = `hsl(${Math.abs(hash % 360)}, 70%, 60%)`;
    const c2 = `hsl(${Math.abs((hash + 40) % 360)}, 70%, 40%)`;
    return `linear-gradient(135deg, ${c1}, ${c2})`;
  }, [eventName]);

  useEffect(() => {
    if (!imgUrl || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const image = new Image();
    image.crossOrigin = "Anonymous";
    image.src = imgUrl;

    let animationFrame;
    let progress = 0;

    image.onload = () => {
      // Set resolution
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;

      const animate = () => {
        if (progress >= 100) {
          ctx.filter = 'none';
          ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
          setIsLoaded(true);
          return;
        }
        progress += 2.5; // Speed of decoding
        
        // Pixelate Logic
        const pixelSize = Math.max(1, 20 - (progress * 0.2)); 
        const w = canvas.width / pixelSize;
        const h = canvas.height / pixelSize;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(image, 0, 0, w, h);
        ctx.drawImage(canvas, 0, 0, w, h, 0, 0, canvas.width, canvas.height);

        // Noise Logic
        if (progress < 90) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                const noise = (Math.random() - 0.5) * (100 - progress) * 1.5;
                data[i] += noise; data[i + 1] += noise; data[i + 2] += noise;
            }
            ctx.putImageData(imageData, 0, 0);
        }
        animationFrame = requestAnimationFrame(animate);
      };
      animate();
    };
    return () => cancelAnimationFrame(animationFrame);
  }, [imgUrl]);

  if (!imgUrl) return null; // Collapses if no banner link

  return (
    <div className="re-card-banner" style={{ background: gradient }}>
      <canvas ref={canvasRef} className="re-dither-canvas" />
      {!isLoaded && <div className="re-banner-loading"><span className="re-loading-text">DECODING...</span></div>}
    </div>
  );
};

// ... (Helper functions like formatTime12h) ...
function formatTime12h(timeString) {
  if (!timeString) return "Time TBA"
  const [hours, minutes] = String(timeString).split(":")
  const hour24 = Number.parseInt(hours, 10)
  if (Number.isNaN(hour24)) return "Time TBA"
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
  const ampm = hour24 >= 12 ? "PM" : "AM"
  return `${hour12}:${minutes} ${ampm}`
}

export default function Registerevent() {
  const navigate = useNavigate()
  const [eventsData, setEventsData] = useState({ upcoming: [], ongoing: [], completed: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState("all")
  
  // Standard States
  const [flash, setFlash] = useState({ type: "", message: "" })
  const [modalFlash, setModalFlash] = useState({ type: "", message: "" })
  const [teamStates, setTeamStates] = useState({})
  const [showTeamModal, setShowTeamModal] = useState(null)
  const [teamFormData, setTeamFormData] = useState({ teamName: '', memberUSNs: [''] })
  const [teamInvites, setTeamInvites] = useState([])
  const [registeredEvents, setRegisteredEvents] = useState(new Set())
  const timerRef = useRef(null)
  const modalTimerRef = useRef(null)
  const [showUpiModal, setShowUpiModal] = useState(null)
  const [transactionId, setTransactionId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("")
  const [ticketInfo, setTicketInfo] = useState(null);

  async function loadEvents() {
    try {
      setLoading(true)
      const response = await fetch('/api/events', { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } })
      if (response.status === 401) { navigate('/'); return }
      const data = await response.json()
      setEventsData({ upcoming: data?.events?.upcoming || [], ongoing: data?.events?.ongoing || [], completed: data?.events?.completed || [] })
    } catch (err) { setError("Failed to load events") } finally { setLoading(false) }
  }

  // --- Handlers (Register, Team, UPI - Simplified placeholders, use your existing logic) ---
  function showFlash(type, message) { setFlash({ type, message }); setTimeout(() => setFlash({ type: "", message: "" }), 4000); }
  function showModalFlash(type, message) { setModalFlash({ type, message }); setTimeout(() => setModalFlash({ type: "", message: "" }), 4000); }
  
  // Initialize
  useEffect(() => { loadEvents(); /* fetchMyRegistrations call */ }, [])

  const allEvents = useMemo(() => {
    return [
      ...(eventsData.upcoming || []).map((e) => ({ ...e, status: "upcoming", upiId: e.upiId, posterUrl: e.posterUrl, bannerUrl: e.bannerUrl })), 
      ...(eventsData.ongoing || []).map((e) => ({ ...e, status: "ongoing", posterUrl: e.posterUrl, bannerUrl: e.bannerUrl })),
      ...(eventsData.completed || []).map((e) => ({ ...e, status: "completed", posterUrl: e.posterUrl, bannerUrl: e.bannerUrl })),
    ]
  }, [eventsData])

  const filteredEvents = useMemo(() => {
    if (filter === "all") return allEvents
    return allEvents.filter((e) => e.status === filter)
  }, [allEvents, filter])

  // --- RENDER ACTIONS ---
  function renderCardActions(event) {
      // Logic for Teams vs Standard
      return (
          <div className="registerevent-actions-footer">
             <div style={{display: 'flex', gap: '10px'}}>
               {/* Register Button */}
               <button className="registerevent-register-btn" onClick={() => {/* your register logic */}}>
                 {event.regFee > 0 ? `Pay ₹${event.regFee}` : 'Register'}
               </button>
               
               {/* ABOUT BUTTON (Uses posterUrl) */}
               {event.posterUrl && (
                 <a 
                   href={event.posterUrl} 
                   target="_blank" 
                   rel="noopener noreferrer" 
                   className="registerevent-team-action-btn"
                   style={{textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40%'}}
                 >
                   <i className="fas fa-info-circle" style={{marginRight: '5px'}}></i> About
                 </a>
               )}
             </div>
          </div>
      )
  }

  return (
    <main className="registerevent-page">
      <div className="registerevent-hero-bg" aria-hidden="true" />
      {ticketInfo && <TicketAnimation onClose={() => setTicketInfo(null)} eventName={ticketInfo.eventName} eventDate={ticketInfo.eventDate} userUSN={ticketInfo.userUSN} />}
      
      <div className="registerevent-container">
        {flash.message && <div className={`registerevent-flash ${flash.type === "success" ? "registerevent-flash-success" : "registerevent-flash-error"}`}>{flash.message}</div>}
        <header className="registerevent-header">
          <div className="registerevent-header-text"><h1 className="registerevent-title">All Events</h1></div>
          <div className="registerevent-filters">{["all", "upcoming", "ongoing", "completed"].map((key) => (<button key={key} className={`registerevent-filter-btn${filter === key ? " registerevent-filter-active" : ""}`} onClick={() => setFilter(key)}>{key.charAt(0).toUpperCase() + key.slice(1)}</button>))}</div>
        </header>

        {!loading && (
          <div className="registerevent-list">
            {filteredEvents.map((event) => {
              const dateStr = event?.eventDate ? new Date(event.eventDate) : null
              const formattedDate = dateStr ? dateStr.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Date TBA"
              
              return (
                <article key={event.eid} className="registerevent-card">
                  {/* 1. VISUAL BANNER (Uses bannerUrl) */}
                  <CustomDitherBanner bannerUrl={event.bannerUrl} eventName={event.ename} />
                  
                  <div className="registerevent-card-content">
                    {/* ... (Existing Content Logic) ... */}
                    <div className="registerevent-card-header">
                        <div className="registerevent-badges"><span className={`registerevent-badge registerevent-badge-${event.status}`}>{event.status}</span></div>
                        <div className="registerevent-card-title-row"><h2 className="registerevent-card-title">{event.ename}</h2></div>
                    </div>
                    <div className="registerevent-info-grid">
                        <div className="registerevent-info-item"><h4>Timeline</h4><p>{formattedDate}<br/>{formatTime12h(event.eventTime)}</p></div>
                        <div className="registerevent-info-item"><h4>Location</h4><p>{event.eventLoc || "TBA"}</p></div>
                    </div>
                  </div>

                  {/* 2. ACTIONS + ABOUT BUTTON (Uses posterUrl) */}
                  {renderCardActions(event)}
                </article>
              )
            })}
          </div>
        )}
        <div className="registerevent-back"><button className="registerevent-back-btn" onClick={() => navigate('/events')}>← Back to Dashboard</button></div>
      </div>
      
      {/* ... (Team/UPI Modals kept unchanged) ... */}
    </main>
  )
}
