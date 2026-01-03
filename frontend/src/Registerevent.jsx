"use client"
import { useEffect, useMemo, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import QRCode from "qrcode"
import "./registerevent.css"
import TicketAnimation from './TicketAnimation';

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
  
  // --- Data States ---
  const [eventsData, setEventsData] = useState({ upcoming: [], ongoing: [], completed: [] })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [teamStates, setTeamStates] = useState({})
  const [registeredEvents, setRegisteredEvents] = useState(new Set())
  
  // --- UI & Modal States ---
  const [flash, setFlash] = useState({ type: "", message: "" })
  const [modalFlash, setModalFlash] = useState({ type: "", message: "" })
  const [selectedEvent, setSelectedEvent] = useState(null) // Controls the Overlay
  const [ticketInfo, setTicketInfo] = useState(null);
  
  // Team Modal
  const [showTeamModal, setShowTeamModal] = useState(null)
  const [teamFormData, setTeamFormData] = useState({ teamName: '', memberUSNs: [''] })
  const [teamInvites, setTeamInvites] = useState([])
  
  // UPI Modal
  const [showUpiModal, setShowUpiModal] = useState(null)
  const [transactionId, setTransactionId] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("")
  
  const timerRef = useRef(null)
  const modalTimerRef = useRef(null)

  // --- Helpers ---
  function showFlash(type, message) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setFlash({ type, message })
    timerRef.current = setTimeout(() => setFlash({ type: "", message: "" }), 4000)
  }

  function showModalFlash(type, message) {
    if (modalTimerRef.current) clearTimeout(modalTimerRef.current)
    setModalFlash({ type, message })
    modalTimerRef.current = setTimeout(() => setModalFlash({ type: "", message: "" }), 4000)
  }

  function generateUpiUrl(upiId, eventName, amount, eventId) {
    const params = new URLSearchParams({ pa: upiId, pn: eventName, am: amount.toString(), cu: "INR", tn: `Event Registration - ${eventId}` })
    return `upi://pay?${params.toString()}`
  }

  // --- Initial Loaders ---
  useEffect(() => { loadEvents(); fetchMyRegistrations(); }, [])
  
  async function loadEvents() {
    try {
      setLoading(true)
      const response = await fetch('/api/events', { method: "GET", credentials: "include" })
      if (response.status === 401) { navigate('/'); return }
      if (!response.ok) throw new Error("Failed to load")
      const data = await response.json()
      setEventsData({ upcoming: data?.events?.upcoming || [], ongoing: data?.events?.ongoing || [], completed: data?.events?.completed || [] })
    } catch (err) {
      showFlash("error", "Failed to load events")
    } finally {
      setLoading(false)
    }
  }

  async function fetchMyRegistrations() {
    try {
      const res = await fetch('/api/my-participant-events', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        const eventIds = new Set(data.participantEvents.map(ev => ev.eid))
        setRegisteredEvents(eventIds)
      }
    } catch (err) { console.error(err) }
  }

  async function loadTeamStatus(eventId) {
    try {
      const response = await fetch(`/api/events/${eventId}/team-status`, { credentials: 'include' })
      if (response.ok) {
        const data = await response.json()
        setTeamStates(prev => ({ ...prev, [eventId]: data }))
      }
    } catch (err) { console.error(err) }
  }

  useEffect(() => { 
    const activeEvents = [...(eventsData.upcoming || []), ...(eventsData.ongoing || [])]; 
    activeEvents.forEach(event => { loadTeamStatus(event.eid) }) 
  }, [eventsData])

  const filteredEvents = useMemo(() => {
    const all = [
      ...(eventsData.upcoming || []).map(e => ({ ...e, status: "upcoming" })), 
      ...(eventsData.ongoing || []).map(e => ({ ...e, status: "ongoing" })),
      ...(eventsData.completed || []).map(e => ({ ...e, status: "completed" })),
    ]
    return filter === "all" ? all : all.filter(e => e.status === filter)
  }, [eventsData, filter])

  // --- Generate QR Code ---
  useEffect(() => {
    if (showUpiModal) {
      const { event } = showUpiModal
      const upiUrl = generateUpiUrl(event.upiId, event.ename, event.regFee, event.eid)
      QRCode.toDataURL(upiUrl, { width: 280, margin: 2, color: { dark: '#000000', light: '#ffffff' } }).then(setQrCodeDataUrl)
    } else { setQrCodeDataUrl("") }
  }, [showUpiModal])

  // ================= ACTION HANDLERS =================

  async function handleRegister(event) {
    const hasFee = (event.regFee || 0) > 0; const eventId = event.eid
    if (hasFee) {
      if (!event.upiId) { showFlash("error", "Organizer hasn't set up payments."); return }
      setTransactionId(""); setModalFlash({ type: "", message: "" }); setShowUpiModal({ event, isTeam: false }); return
    }
    try {
      const response = await fetch(`/api/events/${eventId}/join`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } })
      const data = await response.json()
      if (!response.ok) { showFlash("error", data.error || "Failed"); return }
      showFlash("success", "Registered successfully!")
      setRegisteredEvents(prev => new Set(prev).add(eventId))
      setTicketInfo({ eventName: event.ename, eventDate: event.eventDate, userUSN: data.userUSN || "AUTHORIZED" })
      await loadEvents()
    } catch (err) { showFlash("error", "Network error") }
  }

  async function handleCreateTeam(eventId) {
    try {
      const { teamName, memberUSNs } = teamFormData
      if (!teamName.trim()) { showModalFlash('error', 'Team name required'); return }
      const validUSNs = memberUSNs.filter(usn => usn.trim() !== '')
      const response = await fetch(`/api/events/${eventId}/create-team`, { 
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ teamName: teamName.trim(), memberUSNs: validUSNs }) 
      })
      const data = await response.json()
      if (!response.ok) { showModalFlash('error', data.error); return }
      showModalFlash('success', 'Team created!'); showFlash('success', 'Team created!')
      setTimeout(() => { setShowTeamModal(null); setTeamFormData({ teamName: '', memberUSNs: [''] }); loadTeamStatus(eventId) }, 1500)
    } catch (err) { showModalFlash('error', 'Error creating team') }
  }

  async function handleViewInvites(eventId) {
    try {
      const response = await fetch(`/api/events/${eventId}/my-invites`, { credentials: 'include' })
      const data = await response.json()
      if (!response.ok) { showFlash('error', data.error); return }
      if (!data.invites?.length) { showFlash('error', 'No pending invites'); setTeamInvites([]) } 
      else { setTeamInvites(data.invites); setShowTeamModal({ eventId, mode: 'invites' }) }
    } catch (err) { showFlash('error', 'Error loading invites') }
  }

  async function handleConfirmJoin(teamId, eventId) {
    try {
      const response = await fetch(`/api/teams/${teamId}/confirm-join`, { method: 'POST', credentials: 'include' })
      if (!response.ok) { showModalFlash('error', 'Failed to join'); return }
      showModalFlash('success', 'Joined team!'); 
      setTimeout(() => { setShowTeamModal(null); setTeamInvites([]); loadTeamStatus(eventId) }, 1500)
    } catch (err) { showModalFlash('error', 'Error') }
  }

  async function handleRegisterTeam(event, teamState) {
    const eventId = event.eid
    try {
      const response = await fetch(`/api/events/${eventId}/register-team`, { method: 'POST', credentials: 'include' })
      const data = await response.json()
      if (!response.ok) { showFlash('error', data.error); return }
      if (data.requiresPayment) {
        if (!event.upiId) { showFlash("error", "Payment not setup"); return }
        setTransactionId(""); setShowUpiModal({ event, isTeam: true, teamId: teamState.teamId }); return
      }
      showFlash('success', 'Team registered!'); 
      setTicketInfo({ eventName: event.ename, eventDate: event.eventDate, userUSN: data.userUSN });
      await loadTeamStatus(eventId); await loadEvents(); await fetchMyRegistrations()
    } catch (err) { showFlash('error', 'Error registering team') }
  }

  async function handleSubmitUpiPayment() {
    if (!transactionId.trim()) { showModalFlash('error', 'Enter Transaction ID'); return }
    if (isSubmitting) return; setIsSubmitting(true)
    const { event, isTeam } = showUpiModal; const eventId = event.eid; 
    const url = isTeam ? `/api/events/${eventId}/register-team-upi` : `/api/events/${eventId}/register-upi`
    try {
      const response = await fetch(url, { 
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ transaction_id: transactionId.trim() }) 
      })
      const data = await response.json()
      if (!response.ok) { showModalFlash('error', data.error); return }
      showModalFlash('success', 'Submitted for verification!'); 
      setTimeout(async () => { 
        setShowUpiModal(null); setTransactionId(""); showFlash('success', 'Submitted!'); 
        setTicketInfo({ eventName: event.ename, eventDate: event.eventDate, userUSN: data.userUSN || "PENDING" }); 
        await loadEvents(); await loadTeamStatus(eventId); await fetchMyRegistrations() 
      }, 1500)
    } catch (err) { showModalFlash('error', 'Error submitting') } finally { setIsSubmitting(false) }
  }

  // --- Dynamic Button Rendering ---
  function renderControls(event) {
    const teamState = teamStates[event.eid]
    const aboutBtn = event.posterUrl ? (
      <a href={event.posterUrl} target="_blank" rel="noopener noreferrer" className="re-btn about">
        About
      </a>
    ) : null;

    if (!teamState && (event.status !== 'completed')) return <div className="re-btn-group"><button className="re-btn disabled">Loading...</button>{aboutBtn}</div>
    if (event.status === 'completed') return <button className="re-btn disabled">Event Completed</button>

    // Individual Event
    if (!teamState?.isTeamEvent) {
      if (registeredEvents.has(event.eid)) {
        return <div className="re-btn-group"><button className="re-btn success" disabled>✓ Registered</button>{aboutBtn}</div>
      }
      return (
        <div className="re-btn-group">
          <button className="re-btn primary" onClick={() => handleRegister(event)}>
            { (event.regFee || 0) > 0 ? `Pay & Register (₹${event.regFee})` : "Register (Free)" }
          </button>
          {aboutBtn}
        </div>
      )
    }

    // Team Event
    if (teamState.registrationComplete) {
      return <div className="re-btn-group"><button className="re-btn success" disabled>✓ Team Registered</button>{aboutBtn}</div>
    }

    if (teamState.hasJoinedTeam) {
      const isLeader = teamState.isLeader
      return (
        <div className="re-team-controls-group">
          <div className="re-team-status-pill">
             <span>Team: {teamState.teamName}</span>
             <span className={teamState.canRegister ? "ready" : "waiting"}>
               {teamState.joinedCount}/{teamState.minSize} Members
             </span>
          </div>
          <div className="re-btn-group">
            {isLeader ? (
              <button 
                className={`re-btn ${teamState.canRegister ? "primary" : "disabled"}`} 
                onClick={() => teamState.canRegister && handleRegisterTeam(event, teamState)}
                disabled={!teamState.canRegister}
              >
                { (teamState.regFee || 0) > 0 ? `Pay (₹${teamState.regFee})` : "Finalize" }
              </button>
            ) : (
              <button className="re-btn disabled">Waiting for Leader</button>
            )}
            {aboutBtn}
          </div>
        </div>
      )
    }

    return (
      <div className="re-btn-group">
        <button className="re-btn secondary" onClick={() => setShowTeamModal({ eventId: event.eid, mode: 'create' })}>Create Team</button>
        <button className="re-btn ghost" onClick={() => handleViewInvites(event.eid)}>Invites</button>
        {aboutBtn}
      </div>
    )
  }

  return (
    <main className="re-page">
      <div className="re-bg-glow" />
      {ticketInfo && <TicketAnimation onClose={() => setTicketInfo(null)} {...ticketInfo} />}
      {flash.message && <div className={`re-flash ${flash.type}`}>{flash.message}</div>}

      {/* --- LIST VIEW --- */}
      <div className="re-container">
        <header className="re-header">
          <h1>Events</h1>
          <div className="re-filters">
            {["all", "upcoming", "ongoing", "completed"].map(k => (
              <button key={k} className={filter===k?"active":""} onClick={()=>setFilter(k)}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </header>

        {loading ? <div className="re-loader">Loading...</div> : (
          <div className="re-grid">
            {filteredEvents.map(event => (
              <article key={event.eid} className="re-card" onClick={() => setSelectedEvent(event)}>
                <div className="re-card-media">
                  {/* UPDATE: Use bannerUrl ONLY for visual thumbnail */}
                  <img 
                    src={event.bannerUrl || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80"} 
                    alt={event.ename} 
                    loading="lazy"
                  />
                  <div className={`re-badge ${event.status}`}>{event.status}</div>
                  {event.is_team && <div className="re-badge team">Team</div>}
                </div>
                <div className="re-card-content">
                  <h3>{event.ename}</h3>
                  <div className="re-card-meta">
                    <span>{new Date(event.eventDate).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{event.eventLoc}</span>
                  </div>
                  <div className="re-card-cta">View Details &rarr;</div>
                </div>
              </article>
            ))}
          </div>
        )}
        
        <button className="re-back-btn" onClick={() => navigate('/events')}>&larr; Dashboard</button>
      </div>

      {/* --- YOUTUBE SPLIT DETAIL OVERLAY --- */}
      {selectedEvent && (
        <div className="re-overlay-container">
          <div className="re-overlay-split">
            
            {/* TOP 40%: BANNER (Cloudinary bannerUrl) */}
            <div className="re-split-top">
              <button className="re-close-btn" onClick={() => setSelectedEvent(null)}>×</button>
              <div className="re-image-wrapper">
                <img 
                  src={selectedEvent.bannerUrl || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80"} 
                  alt={selectedEvent.ename} 
                />
                <div className="re-image-gradient"></div>
              </div>
            </div>

            {/* BOTTOM 60%: CONTENT */}
            <div className="re-split-bottom">
              <div className="re-detail-content">
                <div className="re-detail-header">
                  <h2>{selectedEvent.ename}</h2>
                  <div className="re-detail-meta-row">
                    <span className="re-meta-pill date">{new Date(selectedEvent.eventDate).toDateString()}</span>
                    <span className="re-meta-pill time">{formatTime12h(selectedEvent.eventTime)}</span>
                    {selectedEvent.regFee > 0 ? 
                      <span className="re-meta-pill fee">₹{selectedEvent.regFee}</span> : 
                      <span className="re-meta-pill free">Free</span>
                    }
                  </div>
                </div>

                <div className="re-detail-section">
                  <h4>About</h4>
                  <p>{selectedEvent.eventdesc}</p>
                </div>

                <div className="re-detail-section info-grid">
                  <div className="re-info-item"><label>Venue</label><span>{selectedEvent.eventLoc}</span></div>
                  <div className="re-info-item"><label>Organizer</label><span>{selectedEvent.organizerName || "Club"}</span></div>
                  {selectedEvent.is_team && (
                    <div className="re-info-item"><label>Team Size</label><span>{selectedEvent.min_team_size}-{selectedEvent.max_team_size} members</span></div>
                  )}
                </div>
                
                {/* Spacer for fixed bottom bar */}
                <div style={{height: '100px'}}></div>
              </div>

              {/* FIXED ACTION BAR */}
              <div className="re-action-bar">
                {renderControls(selectedEvent)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALS --- */}
      {showTeamModal && (
        <div className="re-modal-overlay" onClick={() => setShowTeamModal(null)}>
          <div className="re-modal" onClick={e => e.stopPropagation()}>
            <div className="re-modal-header">
              <h3>{showTeamModal.mode === 'create' ? 'Create Team' : 'Invites'}</h3>
              <button onClick={() => setShowTeamModal(null)}>×</button>
            </div>
            <div className="re-modal-body">
              {modalFlash.message && <div className={`re-mini-flash ${modalFlash.type}`}>{modalFlash.message}</div>}
              {showTeamModal.mode === 'create' ? (
                <>
                  <input className="re-input" placeholder="Team Name" value={teamFormData.teamName} onChange={e => setTeamFormData({...teamFormData, teamName: e.target.value})} />
                  <p className="re-hint">Add Members (USNs)</p>
                  {teamFormData.memberUSNs.map((usn, i) => (
                    <div key={i} className="re-input-group">
                      <input className="re-input" placeholder="Member USN" value={usn} onChange={e => {
                        const newUsns = [...teamFormData.memberUSNs]; newUsns[i] = e.target.value; setTeamFormData({...teamFormData, memberUSNs: newUsns})
                      }} />
                      {i > 0 && <button className="re-btn-icon" onClick={() => {
                        const newUsns = teamFormData.memberUSNs.filter((_, idx) => idx !== i); setTeamFormData({...teamFormData, memberUSNs: newUsns})
                      }}>×</button>}
                    </div>
                  ))}
                  <button className="re-btn-text" onClick={() => setTeamFormData(prev => ({...prev, memberUSNs: [...prev.memberUSNs, '']}))}>+ Add Member</button>
                  <button className="re-btn primary full" onClick={() => handleCreateTeam(showTeamModal.eventId)}>Create Team</button>
                </>
              ) : (
                <div className="re-invites-list">
                  {!teamInvites.length ? <p>No invites.</p> : teamInvites.map((inv, i) => (
                    <div key={i} className="re-invite-card">
                       <div><strong>{inv.teamName}</strong><br/><small>Leader: {inv.leaderName}</small></div>
                       {!inv.registrationComplete && !inv.joinStatus && <button className="re-btn primary small" onClick={() => handleConfirmJoin(inv.teamId, showTeamModal.eventId)}>Join</button>}
                       {inv.joinStatus && <span className="re-status success">Joined</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showUpiModal && (
        <div className="re-modal-overlay" onClick={() => !isSubmitting && setShowUpiModal(null)}>
          <div className="re-modal" onClick={e => e.stopPropagation()}>
            <div className="re-modal-header"><h3>Pay & Register</h3><button disabled={isSubmitting} onClick={() => setShowUpiModal(null)}>×</button></div>
            <div className="re-modal-body center">
               <div className="re-qr-wrap">{qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="QR" /> : <div className="re-loader-mini"></div>}</div>
               <p>Pay <strong>₹{showUpiModal.event.regFee}</strong></p>
               <div className="re-upi-info">UPI: {showUpiModal.event.upiId}</div>
               <input className="re-input" placeholder="Transaction ID (UTR)" value={transactionId} onChange={e => setTransactionId(e.target.value)} disabled={isSubmitting} />
               <button className="re-btn primary full" onClick={handleSubmitUpiPayment} disabled={isSubmitting}>{isSubmitting ? "Verifying..." : "Submit"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
