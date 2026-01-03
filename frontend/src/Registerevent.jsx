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
  
  // Data States
  const [eventsData, setEventsData] = useState({ upcoming: [], ongoing: [], completed: [] })
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all")
  const [teamStates, setTeamStates] = useState({})
  const [registeredEvents, setRegisteredEvents] = useState(new Set())
  
  // UI States
  const [flash, setFlash] = useState({ type: "", message: "" })
  const [modalFlash, setModalFlash] = useState({ type: "", message: "" })
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [ticketInfo, setTicketInfo] = useState(null);
  
  // Modals
  const [showTeamModal, setShowTeamModal] = useState(null)
  const [teamFormData, setTeamFormData] = useState({ teamName: '', memberUSNs: [''] })
  const [teamInvites, setTeamInvites] = useState([])
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

  // --- Loaders ---
  useEffect(() => { loadEvents(); fetchMyRegistrations(); }, [])
  
  async function loadEvents() {
    try {
      setLoading(true)
      const response = await fetch('/api/events', { method: "GET", credentials: "include" })
      if (response.status === 401) { navigate('/'); return }
      if (!response.ok) throw new Error("Failed")
      const data = await response.json()
      setEventsData({ upcoming: data?.events?.upcoming || [], ongoing: data?.events?.ongoing || [], completed: data?.events?.completed || [] })
    } catch (err) { showFlash("error", "Failed to load events") } 
    finally { setLoading(false) }
  }

  async function fetchMyRegistrations() {
    try {
      const res = await fetch('/api/my-participant-events', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setRegisteredEvents(new Set(data.participantEvents.map(ev => ev.eid)))
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
      if (!event.upiId) { showFlash("error", "Payment not setup."); return }
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

  // --- Dynamic Button Logic (Returns just the main action button) ---
  function getActionButtons(event, isCardView = false) {
    const teamState = teamStates[event.eid]
    const aboutBtn = event.posterUrl ? (
      <a 
        href={event.posterUrl} 
        target="_blank" 
        rel="noopener noreferrer" 
        className="registerevent-btn about"
        onClick={(e) => e.stopPropagation()}
      >
        About
      </a>
    ) : null;

    // 1. Loading
    if (!teamState && (event.status !== 'completed')) return <button className="registerevent-btn disabled">Loading...</button>
    // 2. Completed
    if (event.status === 'completed') return <button className="registerevent-btn disabled">Closed</button>

    // 3. Individual Event
    if (!teamState?.isTeamEvent) {
      if (registeredEvents.has(event.eid)) {
        return <button className="registerevent-btn success" disabled>✓ Registered</button>
      }
      return (
        <button 
          className="registerevent-btn primary" 
          onClick={(e) => { e.stopPropagation(); handleRegister(event); }}
        >
          { (event.regFee || 0) > 0 ? `Pay ₹${event.regFee}` : "Register" }
        </button>
      )
    }

    // 4. Team Event
    if (teamState.registrationComplete) return <button className="registerevent-btn success" disabled>✓ Team Reg.</button>

    if (teamState.hasJoinedTeam) {
      const isLeader = teamState.isLeader
      if (isLeader) {
        return (
          <button 
            className={`registerevent-btn ${teamState.canRegister ? "primary" : "disabled"}`} 
            onClick={(e) => { e.stopPropagation(); teamState.canRegister && handleRegisterTeam(event, teamState); }}
            disabled={!teamState.canRegister}
          >
            { (teamState.regFee || 0) > 0 ? `Pay ₹${teamState.regFee}` : "Finalize" }
          </button>
        )
      } else {
        return <button className="registerevent-btn disabled">Waiting</button>
      }
    }

    // Not joined yet
    return (
      <button className="registerevent-btn secondary" onClick={(e) => { e.stopPropagation(); setShowTeamModal({ eventId: event.eid, mode: 'create' }) }}>
        Create Team
      </button>
    )
  }

  return (
    <main className="registerevent-page">
      <div className="registerevent-hero-bg" aria-hidden="true" />
      {ticketInfo && <TicketAnimation onClose={() => setTicketInfo(null)} {...ticketInfo} />}
      {flash.message && <div className={`registerevent-flash ${flash.type === 'success' ? 'registerevent-flash-success' : 'registerevent-flash-error'}`}>{flash.message}</div>}

      {/* --- LIST VIEW --- */}
      <div className="registerevent-container">
        <header className="registerevent-header">
          <div className="registerevent-header-text">
            <h1 className="registerevent-title">Events</h1>
            <p className="registerevent-subtitle">Discover and join events.</p>
          </div>
          <div className="registerevent-filters">
            {["all", "upcoming", "ongoing", "completed"].map(k => (
              <button key={k} className={`registerevent-filter-btn ${filter===k?"registerevent-filter-active":""}`} onClick={()=>setFilter(k)}>
                {k.charAt(0).toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
        </header>

        {loading ? <div className="registerevent-spinner"></div> : (
          <div className="registerevent-list">
            {filteredEvents.map(event => (
              <article key={event.eid} className="registerevent-card" onClick={() => setSelectedEvent(event)}>
                <div className="registerevent-card-media">
                  <img 
                    src={event.bannerUrl || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80"} 
                    alt={event.ename} 
                    loading="lazy"
                  />
                  <div className={`registerevent-badge ${event.status}`}>{event.status}</div>
                  {event.is_team && <span className="registerevent-badge registerevent-badge-team">Team</span>}
                </div>
                <div className="registerevent-card-content">
                  <h2 className="registerevent-card-title">{event.ename}</h2>
                  <div className="registerevent-card-meta">
                    <span>{new Date(event.eventDate).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>{event.eventLoc}</span>
                  </div>
                  
                  {/* --- CARD ACTION ROW: REGISTER + DETAILS --- */}
                  <div className="registerevent-card-actions">
                    {getActionButtons(event, true)}
                    <button 
                      className="registerevent-btn ghost" 
                      onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                    >
                      Details
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
        
        <div className="registerevent-back">
            <button className="registerevent-back-btn" onClick={() => navigate('/events')}>&larr; Dashboard</button>
        </div>
      </div>

      {/* --- YOUTUBE SPLIT DETAIL OVERLAY --- */}
      {selectedEvent && (
        <div className="registerevent-overlay-container">
          <div className="registerevent-overlay-split">
            {/* TOP 40%: BANNER */}
            <div className="registerevent-split-top">
              <button className="registerevent-close-btn" onClick={() => setSelectedEvent(null)}>×</button>
              <div className="registerevent-image-wrapper">
                <img 
                  src={selectedEvent.bannerUrl || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80"} 
                  alt={selectedEvent.ename} 
                />
                <div className="registerevent-image-gradient"></div>
              </div>
            </div>

            {/* BOTTOM 60%: DETAILS */}
            <div className="registerevent-split-bottom">
              <div className="registerevent-detail-content">
                <h2 className="registerevent-card-title" style={{fontSize: '2rem', marginBottom: '16px'}}>{selectedEvent.ename}</h2>
                <div style={{display: 'flex', gap: '10px', marginBottom: '24px', flexWrap: 'wrap'}}>
                    <span className="registerevent-badge registerevent-badge-upcoming" style={{borderColor: 'rgba(255,255,255,0.2)'}}>{new Date(selectedEvent.eventDate).toDateString()}</span>
                    <span className="registerevent-badge registerevent-badge-upcoming" style={{borderColor: 'rgba(255,255,255,0.2)'}}>{formatTime12h(selectedEvent.eventTime)}</span>
                    {selectedEvent.regFee > 0 ? 
                      <span className="registerevent-badge registerevent-badge-upcoming" style={{color: 'var(--re-accent-cyan)', borderColor: 'var(--re-accent-cyan)'}}>₹{selectedEvent.regFee}</span> : 
                      <span className="registerevent-badge registerevent-badge-ongoing" style={{borderColor: 'var(--re-accent-success)'}}>Free</span>
                    }
                </div>

                <div className="registerevent-hud-panel" style={{background: 'transparent', border: 'none', padding: 0}}>
                  <h4 className="registerevent-hud-label" style={{marginBottom: '10px'}}>About</h4>
                  <p className="registerevent-subtitle" style={{color: '#d4d4d4', fontSize: '0.95rem', maxWidth: '100%'}}>{selectedEvent.eventdesc}</p>
                </div>

                <div className="registerevent-info-grid" style={{marginTop: '32px'}}>
                  <div className="registerevent-info-item"><h4>Venue</h4><p>{selectedEvent.eventLoc}</p></div>
                  <div className="registerevent-info-item"><h4>Organizer</h4><p>{selectedEvent.organizerName || "Club"}</p></div>
                  {selectedEvent.is_team && (
                    <div className="registerevent-info-item"><h4>Team Size</h4><p>{selectedEvent.min_team_size}-{selectedEvent.max_team_size} members</p></div>
                  )}
                </div>
                {/* Spacer */}
                <div style={{height: '100px'}}></div>
              </div>

              {/* FIXED ACTION BAR */}
              <div className="registerevent-action-bar">
                <div className="registerevent-btn-group">
                  {getActionButtons(selectedEvent)}
                  {selectedEvent.posterUrl && (
                    <a href={selectedEvent.posterUrl} target="_blank" rel="noopener noreferrer" className="registerevent-btn about">About</a>
                  )}
                  {teamStates[selectedEvent.eid]?.hasJoinedTeam && !teamStates[selectedEvent.eid]?.isLeader && (
                     // Show invite button if joined but not leader
                     <button className="registerevent-btn ghost" onClick={() => handleViewInvites(selectedEvent.eid)}>Invites</button>
                  )}
                  {/* If not in team, show create team option as secondary in overlay */}
                  {!teamStates[selectedEvent.eid]?.hasJoinedTeam && selectedEvent.is_team && (
                     <button className="registerevent-btn secondary" onClick={() => setShowTeamModal({ eventId: selectedEvent.eid, mode: 'create' })}>Create Team</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODALS (Team & UPI) --- */}
      {showTeamModal && (
        <div className="registerevent-modal-overlay" onClick={() => setShowTeamModal(null)}>
          <div className="registerevent-modal" onClick={e => e.stopPropagation()}>
            <div className="registerevent-modal-header">
              <h2 className="registerevent-modal-title">{showTeamModal.mode === 'create' ? 'Create Team' : 'Invites'}</h2>
              <button className="registerevent-modal-close" onClick={() => setShowTeamModal(null)}>×</button>
            </div>
            <div className="registerevent-modal-body">
              {modalFlash.message && <div className={`registerevent-flash ${modalFlash.type === 'success' ? 'registerevent-flash-success' : 'registerevent-flash-error'}`} style={{position: 'relative', top: 0, left: 0, transform: 'none', width: 'auto', marginBottom: '16px'}}>{modalFlash.message}</div>}
              {showTeamModal.mode === 'create' ? (
                <div className="registerevent-team-form">
                  <div className="registerevent-form-group">
                    <label className="registerevent-form-label">Team Name</label>
                    <input className="registerevent-form-input" placeholder="Enter Team Name" value={teamFormData.teamName} onChange={e => setTeamFormData({...teamFormData, teamName: e.target.value})} />
                  </div>
                  <div className="registerevent-form-group">
                    <label className="registerevent-form-label">Members (USNs)</label>
                    {teamFormData.memberUSNs.map((usn, i) => (
                        <div key={i} style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
                        <input className="registerevent-form-input" placeholder="Member USN" value={usn} onChange={e => {
                            const newUsns = [...teamFormData.memberUSNs]; newUsns[i] = e.target.value; setTeamFormData({...teamFormData, memberUSNs: newUsns})
                        }} />
                        {i > 0 && <button className="registerevent-team-action-btn" style={{width: 'auto', background: 'rgba(255,0,0,0.2)'}} onClick={() => {
                            const newUsns = teamFormData.memberUSNs.filter((_, idx) => idx !== i); setTeamFormData({...teamFormData, memberUSNs: newUsns})
                        }}>×</button>}
                        </div>
                    ))}
                    <button className="registerevent-team-action-btn" style={{marginTop: '8px'}} onClick={() => setTeamFormData(prev => ({...prev, memberUSNs: [...prev.memberUSNs, '']}))}>+ Add Member</button>
                  </div>
                  <button className="registerevent-modal-submit-btn" onClick={() => handleCreateTeam(showTeamModal.eventId)}>Create Team</button>
                </div>
              ) : (
                <div className="registerevent-invites-list">
                  {!teamInvites.length ? <p style={{color: '#888', textAlign: 'center'}}>No pending invites.</p> : teamInvites.map((inv, i) => (
                    <div key={i} className="registerevent-hud-panel" style={{marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                       <div>
                           <div style={{color: 'white', fontWeight: 'bold'}}>{inv.teamName}</div>
                           <div style={{fontSize: '0.8rem', color: '#888'}}>Leader: {inv.leaderName}</div>
                       </div>
                       {!inv.registrationComplete && !inv.joinStatus && <button className="registerevent-invite-confirm-btn" style={{width: 'auto', padding: '8px 16px'}} onClick={() => handleConfirmJoin(inv.teamId, showTeamModal.eventId)}>Join</button>}
                       {inv.joinStatus && <span style={{color: 'var(--re-accent-success)', fontSize: '0.8rem'}}>Joined</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showUpiModal && (
        <div className="registerevent-modal-overlay" onClick={() => !isSubmitting && setShowUpiModal(null)}>
          <div className="registerevent-modal" onClick={e => e.stopPropagation()}>
            <div className="registerevent-modal-header"><h2 className="registerevent-modal-title">Pay & Register</h2><button className="registerevent-modal-close" disabled={isSubmitting} onClick={() => setShowUpiModal(null)}>×</button></div>
            <div className="registerevent-modal-body" style={{textAlign: 'center'}}>
               <div className="registerevent-qr-wrapper">{qrCodeDataUrl ? <img src={qrCodeDataUrl} alt="QR" style={{display: 'block'}} /> : <div className="registerevent-spinner" style={{margin: '40px auto'}}></div>}</div>
               <p style={{color: '#ccc', marginBottom: '20px'}}>Pay <strong>₹{showUpiModal.event.regFee}</strong></p>
               <div className="registerevent-payment-details"><div className="registerevent-payment-row"><span style={{color: '#888'}}>UPI ID</span><span className="registerevent-payment-value">{showUpiModal.event.upiId}</span></div></div>
               <input className="registerevent-form-input" placeholder="Transaction ID (UTR)" value={transactionId} onChange={e => setTransactionId(e.target.value)} disabled={isSubmitting} />
               <button className="registerevent-modal-submit-btn" style={{marginTop: '16px'}} onClick={handleSubmitUpiPayment} disabled={isSubmitting}>{isSubmitting ? "Verifying..." : "Submit Payment"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
