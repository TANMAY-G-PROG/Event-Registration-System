"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import { useNavigate } from "react-router-dom"
import QRCode from "qrcode"
import "./registerevent.css"

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
  const [teamStates, setTeamStates] = useState({})
  const [showTeamModal, setShowTeamModal] = useState(null)
  const [teamFormData, setTeamFormData] = useState({
    teamName: '',
    memberUSNs: ['']
  })
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

  // Generate UPI payment URL
  function generateUpiUrl(upiId, eventName, amount, eventId) {
    const params = new URLSearchParams({
      pa: upiId,
      pn: eventName,
      am: amount.toString(),
      cu: "INR",
      tn: `Event Registration - ${eventId}`
    })
    return `upi://pay?${params.toString()}`
  }

  // Generate QR Code from UPI URL
  async function generateQRCode(upiUrl) {
    try {
      const qrDataUrl = await QRCode.toDataURL(upiUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'M'
      })
      setQrCodeDataUrl(qrDataUrl)
    } catch (err) {
      console.error('Error generating QR code:', err)
      showModalFlash('error', 'Failed to generate QR code')
    }
  }

  // Generate QR when UPI modal opens
  useEffect(() => {
    if (showUpiModal) {
      const { event } = showUpiModal
      const upiUrl = generateUpiUrl(
        event.upiId,
        event.ename,
        event.regFee,
        event.eid
      )
      generateQRCode(upiUrl)
    } else {
      setQrCodeDataUrl("")
    }
  }, [showUpiModal])

  async function loadEvents() {
    try {
      setLoading(true)
      setError("")
      
      const url = '/api/events'
      
      const response = await fetch(url, { 
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        }
      })
      
      if (response.status === 401) {
        navigate('/')
        return
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      
      setEventsData({
        upcoming: data?.events?.upcoming || [],
        ongoing: data?.events?.ongoing || [],
        completed: data?.events?.completed || [],
      })
    } catch (err) {
      console.error("Error loading events:", err)
      setError(err?.message || "Failed to load events")
    } finally {
      setLoading(false)
    }
  }

  async function loadTeamStatus(eventId) {
    try {
      const url = `/api/events/${eventId}/team-status`
      
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!response.ok) {
        return
      }

      const data = await response.json()
      setTeamStates(prev => ({
        ...prev,
        [eventId]: data
      }))
    } catch (err) {
      console.error('Error loading team status:', err)
    }
  }

  async function fetchMyRegistrations() {
    try {
      const res = await fetch('/api/my-participant-events', { 
        credentials: 'include' 
      })
      if (!res.ok) return
      const data = await res.json()
      const eventIds = new Set(data.participantEvents.map(ev => ev.eid))
      setRegisteredEvents(eventIds)
    } catch (err) {
      console.error('Error loading registrations:', err)
    }
  }

  useEffect(() => {
    loadEvents()
    fetchMyRegistrations()
    
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (modalTimerRef.current) clearTimeout(modalTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const upcomingEvents = eventsData.upcoming || []
    upcomingEvents.forEach(event => {
      loadTeamStatus(event.eid)
    })
  }, [eventsData.upcoming])

  const allEvents = useMemo(() => {
    return [
      ...(eventsData.upcoming || []).map((e) => ({ ...e, status: "upcoming", upiId: e.upiId })), 
      ...(eventsData.ongoing || []).map((e) => ({ ...e, status: "ongoing" })),
      ...(eventsData.completed || []).map((e) => ({ ...e, status: "completed" })),
    ]
  }, [eventsData])

  const filteredEvents = useMemo(() => {
    if (filter === "all") {
      return allEvents
    }
    return allEvents.filter((e) => e.status === filter)
  }, [allEvents, filter])

  async function handleRegister(event) {
    const hasFee = (event.regFee || 0) > 0
    const eventId = event.eid

    if (hasFee) {
      if (!event.upiId) {
        showFlash("error", "Organizer has not set up payments for this event.")
        return
      }
      setTransactionId("")
      setModalFlash({ type: "", message: "" })
      setShowUpiModal({ event, isTeam: false })
      return
    }

    try {
      const response = await fetch(`/api/events/${eventId}/join`, { 
        method: "POST",
        credentials: "include",
        headers: { 
          "Content-Type": "application/json" 
        }
      })
      
      const data = await response.json().catch(() => ({}))
      
      if (!response.ok) {
        if (response.status === 401) {
          showFlash("error", "Please sign in to register for events")
          setTimeout(() => navigate('/'), 2000)
          return
        }
        showFlash("error", data?.error || data?.message || "Registration failed")
        return
      }
      
      showFlash("success", data?.message || "Successfully registered for the event!")
      setRegisteredEvents(prev => new Set(prev).add(eventId))
      await loadEvents()
    } catch (err) {
      console.error("Registration error:", err)
      showFlash("error", "Registration failed. Please try again.")
    }
  }

  async function handleCreateTeam(eventId) {
    try {
      const { teamName, memberUSNs } = teamFormData
      
      if (!teamName.trim()) {
        showModalFlash('error', 'Please enter a team name')
        return
      }

      const validUSNs = memberUSNs.filter(usn => usn.trim() !== '')

      const response = await fetch(`/api/events/${eventId}/create-team`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamName: teamName.trim(),
          memberUSNs: validUSNs
        })
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const errorMsg = data?.error || 'Failed to create team'
        showModalFlash('error', errorMsg)
        return
      }

      const successMsg = data?.message || 'Team created successfully!'
      showModalFlash('success', successMsg)
      showFlash('success', successMsg)
      
      setTimeout(() => {
        setShowTeamModal(null)
        setTeamFormData({ teamName: '', memberUSNs: [''] })
        loadTeamStatus(eventId)
      }, 1500)
    } catch (err) {
      console.error('Error creating team:', err)
      showModalFlash('error', 'Error creating team')
    }
  }

  async function handleViewInvites(eventId) {
    try {
      const response = await fetch(`/api/events/${eventId}/my-invites`, { 
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const errorMsg = data?.error || 'Failed to load invites'
        showFlash('error', errorMsg)
        return
      }

      if (!data.invites || data.invites.length === 0) {
        showFlash('error', 'You have no team invites for this event')
        setTeamInvites([])
      } else {
        setTeamInvites(data.invites)
        setShowTeamModal({ eventId, mode: 'invites' })
      }
      
    } catch (err) {
      console.error('Error loading invites:', err)
      showFlash('error', 'Error loading invites')
    }
  }

  async function handleConfirmJoin(teamId, eventId) {
    try {
      const response = await fetch(`/api/teams/${teamId}/confirm-join`, { 
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const errorMsg = data?.error || 'Failed to join team'
        showModalFlash('error', errorMsg)
        return
      }

      const successMsg = data?.message || 'Successfully joined team!'
      showModalFlash('success', successMsg)
      
      setTimeout(() => {
        setShowTeamModal(null)
        setTeamInvites([])
        loadTeamStatus(eventId)
      }, 1500)
    } catch (err) {
      console.error('Error confirming join:', err)
      showModalFlash('error', 'Error confirming join')
    }
  }  

  async function handleRegisterTeam(event, teamState) {
    const eventId = event.eid
    try {
      const response = await fetch(`/api/events/${eventId}/register-team`, { 
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        showFlash('error', data?.error || 'Failed to register team')
        return
      }

      if (data.requiresPayment) {
        if (!event.upiId) {
          showFlash("error", "Organizer has not set up payments for this event.")
          return
        }
        setTransactionId("")
        setModalFlash({ type: "", message: "" })
        setShowUpiModal({ event, isTeam: true, teamId: teamState.teamId })
        return
      }

      showFlash('success', data?.message || 'Team registered successfully!')
      await loadTeamStatus(eventId)
      await loadEvents()
      await fetchMyRegistrations()
    } catch (err) {
      console.error('Error registering team:', err)
      showFlash('error', 'Error registering team')
    }
  }

  function addMemberField() {
    setTeamFormData(prev => ({
      ...prev,
      memberUSNs: [...prev.memberUSNs, '']
    }))
  }

  function removeMemberField(index) {
    setTeamFormData(prev => ({
      ...prev,
      memberUSNs: prev.memberUSNs.filter((_, i) => i !== index)
    }))
  }

  function updateMemberUSN(index, value) {
    setTeamFormData(prev => ({
      ...prev,
      memberUSNs: prev.memberUSNs.map((usn, i) => i === index ? value : usn)
    }))
  }

  async function handleSubmitUpiPayment() {
    if (!transactionId.trim()) {
      showModalFlash('error', 'Please enter a valid Transaction ID')
      return
    }

    if (isSubmitting) return
    setIsSubmitting(true)

    const { event, isTeam } = showUpiModal
    const eventId = event.eid

    const url = isTeam
      ? `/api/events/${eventId}/register-team-upi`
      : `/api/events/${eventId}/register-upi`
      
    const body = JSON.stringify({
      transaction_id: transactionId.trim()
    })

    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: body
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        const errorMsg = data?.error || 'Failed to submit payment'
        showModalFlash('error', errorMsg)
        return
      }

      const successMsg = data?.message || 'Registration submitted for verification!'
      showModalFlash('success', successMsg)

      setTimeout(async () => {
        setShowUpiModal(null)
        setTransactionId("")
        showFlash('success', successMsg)
        await loadEvents()
        await loadTeamStatus(eventId)
        await fetchMyRegistrations()
      }, 1500)

    } catch (err) {
      console.error('Error submitting UPI payment:', err)
      showModalFlash('error', 'An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleGoBack() {
    navigate('/events')
  }

  function renderTeamControls(event) {
    const teamState = teamStates[event.eid]
    
    if (!teamState) {
      return <div className="registerevent-team-loading">Syncing team status...</div>
    }

    // 1. Not a team event
    if (!teamState.isTeamEvent) {
      if (registeredEvents.has(event.eid)) {
        return (
          <div className="registerevent-actions-footer">
            <button disabled className="registerevent-register-btn" style={{opacity: 0.6, cursor: 'default'}}>
              ✓ Registered
            </button>
          </div>
        );
      }
      return (
        <div className="registerevent-actions-footer">
          <button
            type="button"
            className="registerevent-register-btn"
            onClick={() => handleRegister(event)}
          >
            { (event.regFee || 0) > 0 ? `Pay & Register (₹${event.regFee})` : "Register (Free)" }
          </button>
        </div>
      );
    }

    // 2. Team Registration Complete
    if (teamState.registrationComplete) {
      return (
        <div className="registerevent-actions-footer">
          <button disabled className="registerevent-register-btn" style={{opacity: 0.6, cursor: 'default'}}>
            ✓ Team Registered
          </button>
        </div>
      )
    }

    // 3. User has joined a team
    if (teamState.hasJoinedTeam) {
      const isLeader = teamState.isLeader;
      return (
        <div className="registerevent-actions-footer">
          <div className="registerevent-hud-panel">
            <div className="registerevent-hud-header">
              <span className="registerevent-hud-label">Team Unit</span>
              <span className="registerevent-hud-value">{teamState.teamName}</span>
            </div>
            
            <div className="registerevent-member-stack">
              <span className="registerevent-hud-label" style={{marginBottom: '4px'}}>Roster</span>
              {teamState.members?.map((member, idx) => (
                <div key={idx} className="registerevent-member-row">
                  <span>{member.student?.sname || member.student_usn}</span>
                  <span className={`registerevent-status-indicator ${member.join_status ? "joined" : "pending"}`}>
                    {member.join_status ? "Joined" : "Pending"}
                  </span>
                </div>
              ))}
            </div>

            <div style={{marginTop: '16px'}}>
              <div className="registerevent-hud-label" style={{marginBottom: '8px'}}>Status</div>
              {isLeader && teamState.canRegister ? (
                <button
                  type="button"
                  className="registerevent-register-btn"
                  onClick={() => handleRegisterTeam(event, teamState)}
                >
                  { (teamState.regFee || 0) > 0 ? `Pay & Register Team (₹${teamState.regFee})` : "Register Team (Free)" }
                </button>
              ) : (
                <div style={{color: 'var(--re-accent-warning)', fontSize: '0.85rem', padding: '8px', background: 'rgba(255,189,0,0.1)', borderRadius: '6px'}}>
                   {isLeader 
                     ? `Need ${teamState.minSize - teamState.joinedCount} more to confirm`
                     : `Waiting for Leader (${teamState.leaderName || teamState.leaderUSN})`
                   }
                </div>
              )}
            </div>
          </div>
        </div>
      )
    }

    // 4. Default: Create or Join Team
    return (
      <div className="registerevent-actions-footer">
        <div style={{display: 'flex', gap: '10px'}}>
          <button
            type="button"
            className="registerevent-team-action-btn"
            onClick={() => setShowTeamModal({ eventId: event.eid, mode: 'create' })}
          >
            Create Team
          </button>
          <button
            type="button"
            className="registerevent-team-action-btn"
            style={{background: 'transparent', borderColor: 'var(--re-glass-border)'}}
            onClick={() => handleViewInvites(event.eid)}
          >
            View Invites
          </button>
        </div>
      </div>
    )
  }

  return (
    <main className="registerevent-page">
      
      {/* Background Elements */}
      <div className="registerevent-hero-bg" aria-hidden="true" />

      <div className="registerevent-container">
        {flash.message && (
          <div
            className={`registerevent-flash ${
              flash.type === "success" ? "registerevent-flash-success" : "registerevent-flash-error"
            }`}
          >
            {flash.message}
          </div>
        )}

        <header className="registerevent-header">
          <div className="registerevent-header-text">
            <h1 className="registerevent-title">All Events</h1>
            <p className="registerevent-subtitle">
              Discover and join events happening around you.
            </p>
          </div>

          <div className="registerevent-filters">
            {["all", "upcoming", "ongoing", "completed"].map((key) => (
              <button
                key={key}
                className={`registerevent-filter-btn${filter === key ? " registerevent-filter-active" : ""}`}
                onClick={() => setFilter(key)}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </header>

        {loading && (
          <div style={{padding: '60px', textAlign: 'center'}}>
            <div className="registerevent-spinner" />
            <p style={{marginTop: '20px', color: 'var(--re-text-secondary)'}}>Loading events...</p>
          </div>
        )}

        {!loading && !error && filteredEvents.length === 0 && (
          <div style={{padding: '40px', textAlign: 'center', background: 'var(--re-glass-surface)', borderRadius: '20px'}}>
            <p style={{color: 'var(--re-text-secondary)'}}>No events found for "{filter}"</p>
          </div>
        )}

        {!loading && !error && filteredEvents.length > 0 && (
          <div className="registerevent-list">
            {filteredEvents.map((event) => {
              const dateStr = event?.eventDate ? new Date(event.eventDate) : null
              const formattedDate = dateStr
                ? dateStr.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
                : "Date TBA"
              const fee = event?.regFee || 0
              const feeText = fee > 0 ? `₹${fee}` : "Free"

              return (
                <article key={event.eid} className="registerevent-card">
                  <div className="registerevent-card-content">
                    <div className="registerevent-card-header">
                      <div className="registerevent-badges">
                        <span className={`registerevent-badge registerevent-badge-${event.status}`}>
                          {event.status}
                        </span>
                        {event.is_team && (
                          <span className="registerevent-badge registerevent-badge-team">
                            Team Event
                          </span>
                        )}
                      </div>
                      
                      <div className="registerevent-card-title-row" style={{marginTop: '16px'}}>
                        <h2 className="registerevent-card-title">{event.ename}</h2>
                      </div>
                      
                      {event.eventdesc && (
                        <p className="registerevent-card-desc">{event.eventdesc}</p>
                      )}
                    </div>

                    <div className="registerevent-info-grid">
                      <div className="registerevent-info-item">
                        <h4>Timeline</h4>
                        <p>{formattedDate}<br/>{formatTime12h(event.eventTime)}</p>
                      </div>
                      
                      <div className="registerevent-info-item">
                        <h4>Registration Fee</h4>
                        <p>{feeText}</p>
                      </div>
                      
                      <div className="registerevent-info-item">
                        <h4>Location</h4>
                        <p>{event.eventLoc || "TBA"}</p>
                      </div>
                      
                      <div className="registerevent-info-item">
                        <h4>Organizer</h4>
                        <p>{event.organizerName || event.clubName || "System"}</p>
                      </div>

                      {event.is_team ? (
                          <div className="registerevent-info-item">
                           <h4>Team Size</h4>
                           <p>{event.min_team_size} - {event.max_team_size}</p>
                          </div>
                      ) : (
                        event.maxPart && (
                          <div className="registerevent-info-item">
                            <h4>Capacity</h4>
                            <p>{event.maxPart} Seats</p>
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Dynamic Action Footer - Handles all team logic/status logic */}
                  {event.status === "upcoming" && renderTeamControls(event)}
                </article>
              )
            })}
          </div>
        )}

        <div className="registerevent-back">
          <button className="registerevent-back-btn" onClick={handleGoBack}>
            ← Back to Dashboard
          </button>
        </div>
      </div>

      {/* Team Modal */}
      {showTeamModal && (
        <div className="registerevent-modal-overlay" onClick={() => setShowTeamModal(null)}>
          <div className="registerevent-modal" onClick={(e) => e.stopPropagation()}>
            <div className="registerevent-modal-header">
              <h2 className="registerevent-modal-title">
                {showTeamModal.mode === 'create' ? 'Create Team' : 'Team Invites'}
              </h2>
              <button 
                className="registerevent-modal-close"
                onClick={() => setShowTeamModal(null)}
              >
                ×
              </button>
            </div>

            <div className="registerevent-modal-body">
              {modalFlash.message && (
                <div
                  className={`registerevent-flash ${
                    modalFlash.type === "success" ? "registerevent-flash-success" : "registerevent-flash-error"
                  }`}
                  style={{position: 'relative', top: 0, left: 0, transform: 'none', marginBottom: '16px', width: 'auto'}}
                >
                  {modalFlash.message}
                </div>
              )}

              {showTeamModal.mode === 'create' ? (
                <div className="registerevent-team-form">
                  <div className="registerevent-form-group">
                    <label className="registerevent-form-label">Team Name</label>
                    <input
                      type="text"
                      className="registerevent-form-input"
                      value={teamFormData.teamName}
                      onChange={(e) => setTeamFormData(prev => ({ ...prev, teamName: e.target.value }))}
                      placeholder="Enter team name"
                    />
                  </div>

                  <div className="registerevent-form-group">
                    <label className="registerevent-form-label">Team Members (USNs)</label>
                    <p style={{fontSize: '0.8rem', color: 'var(--re-text-tertiary)', marginBottom: '12px'}}>
                      Add your team members' USNs. You are automatically the team leader.
                    </p>
                    {teamFormData.memberUSNs.map((usn, index) => (
                      <div key={index} style={{display: 'flex', gap: '8px', marginBottom: '8px'}}>
                        <input
                          type="text"
                          className="registerevent-form-input"
                          value={usn}
                          onChange={(e) => updateMemberUSN(index, e.target.value)}
                          placeholder="Enter USN"
                        />
                        {teamFormData.memberUSNs.length > 0 && index > 0 && (
                          <button
                            type="button"
                            className="registerevent-team-action-btn"
                            style={{width: 'auto', background: 'rgba(255,0,0,0.2)', borderColor: 'transparent'}}
                            onClick={() => removeMemberField(index)}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      className="registerevent-team-action-btn"
                      style={{marginTop: '8px', fontSize: '0.85rem', padding: '8px 16px'}}
                      onClick={addMemberField}
                    >
                      + Add Member
                    </button>
                  </div>

                  <button
                    type="button"
                    className="registerevent-modal-submit-btn"
                    onClick={() => handleCreateTeam(showTeamModal.eventId)}
                  >
                    Create Team
                  </button>
                </div>
              ) : (
                <div className="registerevent-invites-list">
                  {teamInvites.length === 0 ? (
                    <div style={{padding: '32px', textAlign: 'center', color: 'var(--re-text-secondary)'}}>
                      You have no pending team invites for this event.
                    </div>
                  ) : (
                    <>
                      {teamInvites.map((invite, index) => (
                        <div key={index} className="registerevent-hud-panel" style={{marginBottom: '12px'}}>
                          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
                            <div>
                              <div style={{fontSize: '1rem', fontWeight: 'bold', color: 'white'}}>{invite.teamName}</div>
                              <div style={{fontSize: '0.8rem', color: 'var(--re-text-secondary)'}}>Leader: {invite.leaderName}</div>
                            </div>
                            {invite.registrationComplete && (
                              <div className="registerevent-badge registerevent-badge-completed">Locked</div>
                            )}
                          </div>
                          
                          {!invite.registrationComplete && !invite.joinStatus && (
                            <button
                              type="button"
                              className="registerevent-invite-confirm-btn"
                              onClick={() => handleConfirmJoin(invite.teamId, showTeamModal.eventId)}
                            >
                              Confirm Join
                            </button>
                          )}
                          {invite.joinStatus && (
                            <div className="registerevent-status-indicator joined">Joined</div>
                          )}
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
            <div className="registerevent-modal-header">
              <h2 className="registerevent-modal-title">Complete Payment</h2>
              <button 
                className="registerevent-modal-close"
                onClick={() => !isSubmitting && setShowUpiModal(null)}
                disabled={isSubmitting}
              >
                ×
              </button>
            </div>

            <div className="registerevent-modal-body">
              {modalFlash.message && (
                <div
                  className={`registerevent-flash ${
                    modalFlash.type === "success" ? "registerevent-flash-success" : "registerevent-flash-error"
                  }`}
                  style={{position: 'relative', top: 0, left: 0, transform: 'none', marginBottom: '16px', width: 'auto'}}
                >
                  {modalFlash.message}
                </div>
              )}

              <div style={{textAlign: 'center'}}>
                {/* QR Code */}
                <div className="registerevent-qr-wrapper">
                  {qrCodeDataUrl ? (
                    <img src={qrCodeDataUrl} alt="UPI QR" style={{display: 'block', maxWidth: '100%'}} />
                  ) : (
                    <div className="registerevent-spinner" style={{margin: '40px auto'}} />
                  )}
                </div>
                
                <p style={{color: 'var(--re-text-secondary)', marginBottom: '24px', fontSize: '0.9rem'}}>
                  Scan to pay via any UPI App
                </p>

                {/* Details */}
                <div className="registerevent-payment-details">
                  <div className="registerevent-payment-row">
                    <span style={{color:'var(--re-text-secondary)'}}>Amount</span>
                    <span className="registerevent-payment-value">₹{showUpiModal.event.regFee}</span>
                  </div>
                  <div className="registerevent-payment-row">
                    <span style={{color:'var(--re-text-secondary)'}}>UPI ID</span>
                    <span className="registerevent-payment-value">{showUpiModal.event.upiId}</span>
                  </div>
                </div>

                <a
                    href={generateUpiUrl(
                      showUpiModal.event.upiId,
                      showUpiModal.event.ename,
                      showUpiModal.event.regFee,
                      showUpiModal.event.eid
                    )}
                    className="registerevent-upi-pay-btn"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{marginBottom: '24px'}}
                >
                  Pay via UPI App
                </a>

                <div style={{borderTop: '1px solid var(--re-glass-border)', paddingTop: '24px', textAlign: 'left'}}>
                   <div className="registerevent-form-group">
                    <label className="registerevent-form-label">Transaction ID (UTR)</label>
                    <input
                      type="text"
                      className="registerevent-form-input"
                      value={transactionId}
                      onChange={(e) => setTransactionId(e.target.value)}
                      placeholder="Enter Transaction ID after payment"
                      disabled={isSubmitting}
                    />
                   </div>
                   <button
                    type="button"
                    className="registerevent-modal-submit-btn"
                    onClick={handleSubmitUpiPayment}
                    disabled={isSubmitting}
                   >
                    {isSubmitting ? "Verifying..." : "Submit & Complete Registration"}
                   </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </main>
  )
}
