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
  
  const [eventsData, setEventsData] = useState({ upcoming: [], ongoing: [], completed: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [filter, setFilter] = useState("all")
  const [flash, setFlash] = useState({ type: "", message: "" })
  const [modalFlash, setModalFlash] = useState({ type: "", message: "" })
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [ticketInfo, setTicketInfo] = useState(null);
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

  async function generateQRCode(upiUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(upiUrl, { width: 280, margin: 2, color: { dark: '#000000', light: '#ffffff' }, errorCorrectionLevel: 'M' })
      setQrCodeDataUrl(qrDataUrl)
    } catch (err) {
      showModalFlash('error', 'Failed to generate QR code')
    }
  }

  useEffect(() => {
    if (showUpiModal) {
      const { event } = showUpiModal
      const upiUrl = generateUpiUrl(event.upiId, event.ename, event.regFee, event.eid)
      generateQRCode(upiUrl)
    } else {
      setQrCodeDataUrl("")
    }
  }, [showUpiModal])

  async function loadEvents() {
    try {
      setLoading(true)
      const response = await fetch('/api/events', { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } })
      if (response.status === 401) { navigate('/'); return }
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      const data = await response.json()
      setEventsData({ upcoming: data?.events?.upcoming || [], ongoing: data?.events?.ongoing || [], completed: data?.events?.completed || [] })
    } catch (err) {
      setError(err?.message || "Failed to load events")
    } finally {
      setLoading(false)
    }
  }

  async function loadTeamStatus(eventId) {
    try {
      const response = await fetch(`/api/events/${eventId}/team-status`, { method: 'GET', credentials: 'include', headers: { 'Content-Type': 'application/json' } })
      if (!response.ok) return
      const data = await response.json()
      setTeamStates(prev => ({ ...prev, [eventId]: data }))
    } catch (err) { console.error('Error loading team status:', err) }
  }

  async function fetchMyRegistrations() {
    try {
      const res = await fetch('/api/my-participant-events', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      const eventIds = new Set(data.participantEvents.map(ev => ev.eid))
      setRegisteredEvents(eventIds)
    } catch (err) { console.error('Error loading registrations:', err) }
  }

  useEffect(() => { loadEvents(); fetchMyRegistrations(); return () => { if (timerRef.current) clearTimeout(timerRef.current); if (modalTimerRef.current) clearTimeout(modalTimerRef.current) } }, [])
  useEffect(() => { const activeEvents = [...(eventsData.upcoming || []), ...(eventsData.ongoing || [])]; activeEvents.forEach(event => { loadTeamStatus(event.eid) }) }, [eventsData.upcoming, eventsData.ongoing])

  const allEvents = useMemo(() => {
    return [
      ...(eventsData.upcoming || []).map((e) => ({ ...e, status: "upcoming", upiId: e.upiId, bannerUrl: e.bannerUrl, posterUrl: e.posterUrl })), 
      ...(eventsData.ongoing || []).map((e) => ({ ...e, status: "ongoing", bannerUrl: e.bannerUrl, posterUrl: e.posterUrl })),
      ...(eventsData.completed || []).map((e) => ({ ...e, status: "completed", bannerUrl: e.bannerUrl, posterUrl: e.posterUrl })),
    ]
  }, [eventsData])

  const filteredEvents = useMemo(() => {
    if (filter === "all") return allEvents
    return allEvents.filter((e) => e.status === filter)
  }, [allEvents, filter])

  async function handleRegister(event) {
    const hasFee = (event.regFee || 0) > 0; const eventId = event.eid
    if (hasFee) {
      if (!event.upiId) { showFlash("error", "Organizer has not set up payments for this event."); return }
      setTransactionId(""); setModalFlash({ type: "", message: "" }); setShowUpiModal({ event, isTeam: false }); return
    }
    try {
      const response = await fetch(`/api/events/${eventId}/join`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { 
        if (response.status === 401) { showFlash("error", "Please sign in"); setTimeout(() => navigate('/'), 2000); return; }
        showFlash("error", data?.error || "Registration failed"); return 
      }
      showFlash("success", "Successfully registered!"); setRegisteredEvents(prev => new Set(prev).add(eventId))
      setTicketInfo({ eventName: event.ename, eventDate: event.eventDate, userUSN: data?.userUSN || "AUTHORIZED" }); await loadEvents()
    } catch (err) { showFlash("error", "Registration failed.") }
  }

  async function handleCreateTeam(eventId) {
    try {
      const { teamName, memberUSNs } = teamFormData
      if (!teamName.trim()) { showModalFlash('error', 'Please enter a team name'); return }
      const validUSNs = memberUSNs.filter(usn => usn.trim() !== '')
      const response = await fetch(`/api/events/${eventId}/create-team`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teamName: teamName.trim(), memberUSNs: validUSNs }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { showModalFlash('error', data?.error || 'Failed to create team'); return }
      showModalFlash('success', 'Team created successfully!'); showFlash('success', 'Team created successfully!')
      setTimeout(() => { setShowTeamModal(null); setTeamFormData({ teamName: '', memberUSNs: [''] }); loadTeamStatus(eventId) }, 1500)
    } catch (err) { showModalFlash('error', 'Error creating team') }
  }

  async function handleViewInvites(eventId) {
    try {
      const response = await fetch(`/api/events/${eventId}/my-invites`, { method: 'GET', credentials: 'include', headers: { 'Content-Type': 'application/json' } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { showFlash('error', data?.error || 'Failed to load invites'); return }
      if (!data.invites || data.invites.length === 0) { showFlash('error', 'You have no team invites for this event'); setTeamInvites([]) } 
      else { setTeamInvites(data.invites); setShowTeamModal({ eventId, mode: 'invites' }) }
    } catch (err) { showFlash('error', 'Error loading invites') }
  }

  async function handleConfirmJoin(teamId, eventId) {
    try {
      const response = await fetch(`/api/teams/${teamId}/confirm-join`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { showModalFlash('error', data?.error || 'Failed to join team'); return }
      showModalFlash('success', 'Successfully joined team!'); setTimeout(() => { setShowTeamModal(null); setTeamInvites([]); loadTeamStatus(eventId) }, 1500)
    } catch (err) { showModalFlash('error', 'Error confirming join') }
  }  

  async function handleRegisterTeam(event, teamState) {
    const eventId = event.eid
    try {
      const response = await fetch(`/api/events/${eventId}/register-team`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { showFlash('error', data?.error || 'Failed to register team'); return }
      if (data.requiresPayment) {
        if (!event.upiId) { showFlash("error", "Organizer has not set up payments for this event."); return }
        setTransactionId(""); setModalFlash({ type: "", message: "" }); setShowUpiModal({ event, isTeam: true, teamId: teamState.teamId }); return
      }
      showFlash('success', 'Team registered successfully!')
      setTicketInfo({ eventName: event.ename, eventDate: event.eventDate, userUSN: data?.userUSN || "AUTHORIZED" });
      await loadTeamStatus(eventId); await loadEvents(); await fetchMyRegistrations()
    } catch (err) { showFlash('error', 'Error registering team') }
  }

  function addMemberField() { setTeamFormData(prev => ({ ...prev, memberUSNs: [...prev.memberUSNs, ''] })) }
  function removeMemberField(index) { setTeamFormData(prev => ({ ...prev, memberUSNs: prev.memberUSNs.filter((_, i) => i !== index) })) }
  function updateMemberUSN(index, value) { setTeamFormData(prev => ({ ...prev, memberUSNs: prev.memberUSNs.map((usn, i) => i === index ? value : usn) })) }

  async function handleSubmitUpiPayment() {
    if (!transactionId.trim()) { showModalFlash('error', 'Please enter a valid Transaction ID'); return }
    if (isSubmitting) return; setIsSubmitting(true)
    const { event, isTeam } = showUpiModal; const eventId = event.eid; const url = isTeam ? `/api/events/${eventId}/register-team-upi` : `/api/events/${eventId}/register-upi`
    try {
      const response = await fetch(url, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transaction_id: transactionId.trim() }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) { showModalFlash('error', data?.error || 'Failed to submit payment'); return }
      showModalFlash('success', 'Registration submitted for verification!'); setTimeout(async () => { setShowUpiModal(null); setTransactionId(""); showFlash('success', 'Registration submitted!'); setTicketInfo({ eventName: event.ename, eventDate: event.eventDate, userUSN: data?.userUSN || "AUTHORIZED" }); await loadEvents(); await loadTeamStatus(eventId); await fetchMyRegistrations() }, 1500)
    } catch (err) { showModalFlash('error', 'An error occurred.') } finally { setIsSubmitting(false) }
  }

  // --- OPEN POSTER FUNCTION ---
  const handleOpenPoster = (e, url) => {
    e.stopPropagation();
    if(url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  function renderControls(event, isOverlay = false) {
    const teamState = teamStates[event.eid]; 
    if (!teamState) return <button className="registerevent-register-btn" disabled style={{opacity: 0.6}}>Loading...</button>
    
    const aboutBtn = (event.posterUrl && isOverlay) ? (
      <button 
          className="registerevent-btn about"
          onClick={(e) => handleOpenPoster(e, event.posterUrl)}
      >
          View Original Poster ↗
      </button>
    ) : null;

    if (!teamState.isTeamEvent) {
      if (registeredEvents.has(event.eid)) {
        return (
          <div className="registerevent-btn-group">
            <button disabled className="registerevent-register-btn" style={{opacity: 0.6}}>✓ Registered</button>
            {aboutBtn}
          </div>
        )
      }
      return (
        <div className="registerevent-btn-group">
          <button type="button" className="registerevent-register-btn" onClick={(e) => { e.stopPropagation(); handleRegister(event); }}>
            { (event.regFee || 0) > 0 ? `Pay & Register (₹${event.regFee})` : "Register (Free)" }
          </button>
          {aboutBtn}
        </div>
      )
    }

    if (teamState.registrationComplete) {
      return (
        <div className="registerevent-btn-group">
          <button disabled className="registerevent-register-btn" style={{opacity: 0.6}}>✓ Team Registered</button>
          {aboutBtn}
        </div>
      )
    }
    
    if (teamState.hasJoinedTeam) {
      const isLeader = teamState.isLeader;
      return (
        <div className="registerevent-team-controls-group">
          {isOverlay && (
            <div className="registerevent-hud-panel" style={{marginBottom: '10px'}}>
               <div className="registerevent-hud-header" style={{marginBottom: '0', paddingBottom: '0', border: 'none'}}>
                 <span className="registerevent-hud-label">Team: {teamState.teamName}</span>
                 <span className="registerevent-hud-value" style={{color: teamState.canRegister ? 'var(--re-accent-success)' : 'var(--re-accent-warning)'}}>
                   {teamState.joinedCount}/{teamState.minSize} Members
                 </span>
               </div>
            </div>
          )}
          <div className="registerevent-btn-group">
            {isLeader ? (
              <button 
                type="button" 
                className="registerevent-register-btn" 
                onClick={(e) => { e.stopPropagation(); teamState.canRegister && handleRegisterTeam(event, teamState) }}
                disabled={!teamState.canRegister}
                style={{opacity: teamState.canRegister ? 1 : 0.6}}
              >
                { (teamState.regFee || 0) > 0 ? `Pay & Register Team (₹${teamState.regFee})` : "Register Team (Free)" }
              </button>
            ) : (
              <div style={{color: 'var(--re-accent-warning)', fontSize: '0.85rem', padding: '8px', background: 'rgba(255,189,0,0.1)', borderRadius: '6px', textAlign: 'center'}}>
                Waiting for Leader
              </div>
            )}
            {aboutBtn}
          </div>
        </div>
      )
    }

    return (
      <div className="registerevent-btn-group">
        <div style={{display: 'flex', gap: '10px', flexWrap: 'wrap', width: '100%'}}>
          <button type="button" className="registerevent-team-action-btn" onClick={(e) => { e.stopPropagation(); setShowTeamModal({ eventId: event.eid, mode: 'create' }) }}>Create Team</button>
          <button type="button" className="registerevent-team-action-btn" style={{background: 'transparent', borderColor: 'var(--re-glass-border)'}} onClick={(e) => { e.stopPropagation(); handleViewInvites(event.eid) }}>View Invites</button>
          {aboutBtn}
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
          <div className="registerevent-header-text">
            <h1 className="registerevent-title">All Events</h1>
            <p className="registerevent-subtitle">Discover and join events happening around you.</p>
          </div>
          <div className="registerevent-filters">
            {["all", "upcoming", "ongoing", "completed"].map((key) => (
              <button key={key} className={`registerevent-filter-btn${filter === key ? " registerevent-filter-active" : ""}`} onClick={() => setFilter(key)}>{key.charAt(0).toUpperCase() + key.slice(1)}</button>
            ))}
          </div>
        </header>

        {!loading && !error && filteredEvents.length > 0 && (
          <div className="registerevent-list">
            {filteredEvents.map((event) => {
              const dateStr = event?.eventDate ? new Date(event.eventDate) : null
              const formattedDate = dateStr ? dateStr.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "Date TBA"
              const fee = event?.regFee || 0; const feeText = fee > 0 ? `₹${fee}` : "Free"

              return (
                <article key={event.eid} className="registerevent-card" onClick={() => setSelectedEvent(event)}>
                  <div className="registerevent-card-content">
                    <div className="registerevent-card-header">
                      <div className="registerevent-badges">
                        <span className={`registerevent-badge registerevent-badge-${event.status}`}>{event.status}</span>
                        {event.is_team && <span className="registerevent-badge registerevent-badge-team">Team Event</span>}
                      </div>
                      
                      {/* --- THUMBNAIL (Only shows if bannerUrl exists) --- */}
                      {event.bannerUrl && (
                        <div style={{height: '160px', width: '100%', marginTop: '16px', borderRadius: '12px', overflow: 'hidden', background: '#111'}}>
                            <img 
                              src={event.bannerUrl} 
                              alt={event.ename}
                              style={{width: '100%', height: '100%', objectFit: 'cover'}}
                            />
                        </div>
                      )}

                      <div className="registerevent-card-title-row" style={{marginTop: '16px'}}>
                        <h2 className="registerevent-card-title">{event.ename}</h2>
                      </div>
                      {event.eventdesc && <p className="registerevent-card-desc">{event.eventdesc}</p>}
                    </div>
                    <div className="registerevent-info-grid">
                      <div className="registerevent-info-item"><h4>Timeline</h4><p>{formattedDate}<br/>{formatTime12h(event.eventTime)}</p></div>
                      <div className="registerevent-info-item"><h4>Fee</h4><p>{feeText}</p></div>
                      <div className="registerevent-info-item"><h4>Location</h4><p>{event.eventLoc || "TBA"}</p></div>
                      <div className="registerevent-info-item"><h4>Organizer</h4><p>{event.organizerName || event.clubName || "System"}</p></div>
                    </div>
                  </div>
                  
                  {/* --- CARD ACTIONS --- */}
                  {(event.status === "upcoming" || event.status === "ongoing") && (
                    <div className="registerevent-actions-footer">
                        {renderControls(event, false)}
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
        <div className="registerevent-back"><button className="registerevent-back-btn" onClick={() => navigate('/events')}>← Back to Dashboard</button></div>
      </div>
      
      {/* --- OVERLAY SPLIT VIEW --- */}
      {selectedEvent && (
        <div className="registerevent-overlay-container">
          <div className="registerevent-overlay-split">
            {/* TOP 40%: BANNER (Only if exists) */}
            {selectedEvent.bannerUrl ? (
              <div className="registerevent-split-top">
                <button className="registerevent-close-btn" onClick={() => setSelectedEvent(null)}>×</button>
                <div className="registerevent-image-wrapper">
                  <img src={selectedEvent.bannerUrl} alt={selectedEvent.ename} />
                  <div className="registerevent-image-gradient"></div>
                </div>
              </div>
            ) : (
              <div style={{padding: '20px', display: 'flex', justifyContent: 'flex-end'}}>
                 <button className="registerevent-close-btn" onClick={() => setSelectedEvent(null)}>×</button>
              </div>
            )}

            {/* BOTTOM 60%: DETAILS */}
            <div className="registerevent-split-bottom" style={!selectedEvent.bannerUrl ? {height: '100%'} : {}}>
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
                {/* Spacer for fixed bottom bar */}
                <div style={{height: '100px'}}></div>
              </div>

              {/* FIXED ACTION BAR */}
              <div className="registerevent-action-bar">
                {renderControls(selectedEvent, true)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Modal */}
      {showTeamModal && (
        <div className="registerevent-modal-overlay" onClick={() => setShowTeamModal(null)}>
          <div className="registerevent-modal" onClick={(e) => e.stopPropagation()}>
            <div className="registerevent-modal-header">
              <h2 className="registerevent-modal-title">{showTeamModal.mode === 'create' ? 'Create Team' : 'Team Invites'}</h2>
              <button className="registerevent-modal-close" onClick={() => setShowTeamModal(null)}>×</button>
            </div>
            <div className="registerevent-modal-body">
              {modalFlash.message && <div className={`registerevent-flash ${modalFlash.type === "success" ? "registerevent-flash-success" : "registerevent-flash-error"}`} style={{position: 'relative', top: 0, left: 0, transform: 'none', marginBottom: '16px', width: 'auto'}}>{modalFlash.message}</div>}
              {showTeamModal.mode === 'create' ? (
                <div className="registerevent-team-form">
                  <div className="registerevent-form-group">
                    <label className="registerevent-form-label">Team Name</label>
                    <input type="text" className="registerevent-form-input" value={teamFormData.teamName} onChange={(e) => setTeamFormData(prev => ({ ...prev, teamName: e.target.value }))} placeholder="Enter team name" />
                  </div>
                  <div className="registerevent-form-group">
                    <label className="registerevent-form-label">Team Members (USNs)</label>
                    <p style={{fontSize: '0.8rem', color: 'var(--re-text-tertiary)', marginBottom: '12px'}}>Add your team members' USNs. You are automatically the team leader.</p>
                    {teamFormData.memberUSNs.map((usn, index) => (
                      <div key={index} style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
                        <input type="text" className="registerevent-form-input" value={usn} onChange={(e) => updateMemberUSN(index, e.target.value)} placeholder="Enter USN" />
                        {teamFormData.memberUSNs.length > 0 && index > 0 && (<button type="button" className="registerevent-team-action-btn" style={{width: 'auto', background: 'rgba(255,0,0,0.2)', borderColor: 'transparent'}} onClick={() => removeMemberField(index)}>×</button>)}
                      </div>
                    ))}
                    <button type="button" className="registerevent-team-action-btn" style={{marginTop: '8px', fontSize: '0.85rem', padding: '8px 16px'}} onClick={addMemberField}>+ Add Member</button>
                  </div>
                  <button type="button" className="registerevent-modal-submit-btn" onClick={() => handleCreateTeam(showTeamModal.eventId)}>Create Team</button>
                </div>
              ) : (
                <div className="registerevent-invites-list">
                  {teamInvites.length === 0 ? (<div style={{padding: '32px', textAlign: 'center', color: 'var(--re-text-secondary)'}}>You have no pending team invites for this event.</div>) : (
                    <>
                      {teamInvites.map((invite, index) => (
                        <div key={index} className="registerevent-hud-panel" style={{marginBottom: '12px'}}>
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}><div><div style={{fontSize: '1rem', fontWeight: 'bold', color: 'white'}}>{invite.teamName}</div><div style={{fontSize: '0.8rem', color: 'var(--re-text-secondary)'}}>Leader: {invite.leaderName}</div></div>{invite.registrationComplete && (<div className="registerevent-badge registerevent-badge-completed">Locked</div>)}</div>
                          {!invite.registrationComplete && !invite.joinStatus && (<button type="button" className="registerevent-invite-confirm-btn" onClick={() => handleConfirmJoin(invite.teamId, showTeamModal.eventId)}>Confirm Join</button>)}
                          {invite.joinStatus && (<div className="registerevent-status-indicator joined">Joined</div>)}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* UPI Payment Modal */}
      {showUpiModal && (
        <div className="registerevent-modal-overlay" onClick={() => !isSubmitting && setShowUpiModal(null)}>
          <div className="registerevent-modal" onClick={(e) => e.stopPropagation()}>
            <div className="registerevent-modal-header"><h2 className="registerevent-modal-title">Complete Payment</h2><button className="registerevent-modal-close" onClick={() => !isSubmitting && setShowUpiModal(null)} disabled={isSubmitting}>×</button></div>
            <div className="registerevent-modal-body">
              {modalFlash.message && <div className={`registerevent-flash ${modalFlash.type === "success" ? "registerevent-flash-success" : "registerevent-flash-error"}`} style={{position: 'relative', top: 0, left: 0, transform: 'none', marginBottom: '16px', width: 'auto'}}>{modalFlash.message}</div>}
              <div style={{textAlign: 'center'}}>
                <div className="registerevent-qr-wrapper">{qrCodeDataUrl ? (<img src={qrCodeDataUrl} alt="UPI QR" style={{display: 'block', maxWidth: '100%'}} />) : (<div className="registerevent-spinner" style={{margin: '40px auto'}} />)}</div>
                <p style={{color: 'var(--re-text-secondary)', marginBottom: '24px', fontSize: '0.9rem'}}>Scan to pay via any UPI App</p>
                <div className="registerevent-payment-details"><div className="registerevent-payment-row"><span style={{color:'var(--re-text-secondary)'}}>Amount</span><span className="registerevent-payment-value">₹{showUpiModal.event.regFee}</span></div><div className="registerevent-payment-row"><span style={{color:'var(--re-text-secondary)'}}>UPI ID</span><span className="registerevent-payment-value">{showUpiModal.event.upiId}</span></div></div>
                <a href={generateUpiUrl(showUpiModal.event.upiId, showUpiModal.event.ename, showUpiModal.event.regFee, showUpiModal.event.eid)} className="registerevent-upi-pay-btn" target="_blank" rel="noopener noreferrer" style={{marginBottom: '24px'}}>Pay via UPI App</a>
                <div style={{borderTop: '1px solid var(--re-glass-border)', paddingTop: '24px', textAlign: 'left'}}>
                    <div className="registerevent-form-group"><label className="registerevent-form-label">Transaction ID (UTR)</label><input type="text" className="registerevent-form-input" value={transactionId} onChange={(e) => setTransactionId(e.target.value)} placeholder="Enter Transaction ID after payment" disabled={isSubmitting} /></div>
                    <button type="button" className="registerevent-modal-submit-btn" onClick={handleSubmitUpiPayment} disabled={isSubmitting}>{isSubmitting ? "Verifying..." : "Submit & Complete Registration"}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
